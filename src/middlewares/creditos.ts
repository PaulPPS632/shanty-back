import { randomUUID } from 'crypto';

import type { Request, RequestHandler, Response } from 'express';

import { CREDITS_FAIL_OPEN, CREDITS_FREE_PATHS, CREDITS_MODE } from '../config/env';
import { logCred } from '../config/logger';
import { costoFinal, paramsDe, refrescarPrecios, tarifaDe, type Tarifa } from '../config/precios';
import { ErrorRpc, rpc } from '../config/supabaseAdmin';
import { anotar } from './logMeta';

interface RespuestaReserva {
    ok: boolean;
    motivo?: string;
    movimiento_id?: number | null;
    costo?: number;
    saldo_final?: number;
    duplicado?: boolean;
}

interface RespuestaSaldo {
    saldo: number;
    existe: boolean;
}

export interface Cobro {
    tarifa: Tarifa;
    movimientoId: number;
    reservado: number;
    userId: string;
    cerrado: boolean;
}

function esLibre(path: string): boolean {
    const p = path.toLowerCase();

    return CREDITS_FREE_PATHS.some((libre) => {
        const l = libre.toLowerCase();

        return p === l || p.startsWith(`${l}/`);
    });
}

/**
 * El DNI/RUC que se esta consultando: la columna `objetivo` del libro mayor, que
 * es lo que convierte la contabilidad en el conteo de busquedas.
 *
 * Los :params salen de paramsDe() y NO de req.params, que en un middleware
 * pre-routing esta vacio.
 */
function objetivoDe(req: Request, tarifa: Tarifa): string | null {
    const p = paramsDe(tarifa, req.path);
    const q = req.query as Record<string, unknown>;
    const candidato = p.dni ?? p.ruc ?? q.dni ?? q.ruc ?? q.telefono;

    return typeof candidato === 'string' && candidato ? candidato.slice(0, 40) : null;
}

export const cobroCreditos: RequestHandler = async (req, res, next) => {
    // El preflight no lleva Authorization: un 402 aqui mata la peticion real con
    // un error de CORS opaco. Primero de todo, igual que supabaseAuth.
    if (req.method === 'OPTIONS') {
        next();

        return;
    }

    if (CREDITS_MODE === 'off' || esLibre(req.path)) {
        next();

        return;
    }

    const tarifa = tarifaDe(req.method, req.path);

    if (!tarifa) {
        // Ruta sin tarifa = gratis a proposito. Un endpoint nuevo nunca debe
        // empezar a dar 402 porque alguien olvido la tabla.
        logCred.debug({ ruta: req.path, metodo: req.method }, 'Ruta sin tarifa');
        next();

        return;
    }

    // No bloquea: si el refresco esta en curso o falla, se usa lo que haya.
    void refrescarPrecios();

    // Gratis de tabla: cero RPC, cero latencia. Es lo que mantiene /api/ubigeo/*
    // funcionando con saldo 0.
    if (tarifa.reserva === 0) {
        anotar(res, { tarifa: tarifa.clave, costo: 0 });
        next();

        return;
    }

    if (!req.user) {
        // No hay a quien cobrarle. validarConfig() garantiza AUTH_MODE=enforce
        // cuando CREDITS_MODE=enforce, asi que llegar aqui sin usuario solo pasa
        // si la ruta esta en AUTH_PUBLIC_PATHS.
        anotar(res, { tarifa: tarifa.clave, motivo: 'sin_usuario', costo: 0 });

        if (CREDITS_MODE === 'enforce') {
            rechaza402(req, res, 'sin_usuario', tarifa.reserva, 0);

            return;
        }

        next();

        return;
    }

    // ---- Modo log: se mide, no se cobra. ----
    if (CREDITS_MODE === 'log') {
        let saldo: number | undefined;

        try {
            saldo = (await rpc<RespuestaSaldo>('creditos_saldo_de', { p_user_id: req.user.id })).saldo;
        } catch (e) {
            logCred.warn({ err: e }, 'No se pudo leer el saldo en modo log');
        }

        anotar(res, {
            tarifa: tarifa.clave,
            costo: tarifa.reserva,   // el peor caso; se afina en el cierre
            saldo,
            motivo: saldo !== undefined && saldo < tarifa.reserva ? 'habria_402' : undefined,
        });

        prepararCierreSinCobro(res, tarifa);
        next();

        return;
    }

    // ---- Modo enforce: reserva. ----
    let r: RespuestaReserva;

    try {
        r = await rpc<RespuestaReserva>('creditos_reservar', {
            p_user_id: req.user.id,
            p_costo: tarifa.reserva,
            p_accion: tarifa.clave,
            p_endpoint: `${req.method} ${tarifa.ruta}`,
            p_objetivo: objetivoDe(req, tarifa),
            // CLAVE DE IDEMPOTENCIA GENERADA AQUI, en el servidor.
            // NO se usa req.reqId: requestContext acepta el header X-Request-Id
            // entrante, o sea que lo controla el cliente. Usarlo para el cobro
            // daria busquedas gratis ilimitadas mandando siempre el mismo valor.
            p_idem_key: randomUUID(),
            p_req_id: req.reqId,
            p_grupo: null,
            p_meta: {},
        });
    } catch (e) {
        const abre = CREDITS_FAIL_OPEN && !tarifa.fallaCerrado;

        logCred.error(
            { err: e, reqId: req.reqId, tarifa: tarifa.clave, abre },
            `Fallo el RPC de reserva (${e instanceof ErrorRpc ? e.motivo : 'desconocido'})`,
        );
        anotar(res, { tarifa: tarifa.clave, motivo: 'creditos_caido', costo: 0 });

        if (abre) {
            next();

            return;
        }

        rechaza402(req, res, 'servicio', tarifa.reserva, undefined);

        return;
    }

    if (!r.ok) {
        anotar(res, { tarifa: tarifa.clave, motivo: r.motivo, costo: 0, saldo: r.saldo_final ?? 0 });
        rechaza402(req, res, r.motivo ?? 'saldo_insuficiente', tarifa.reserva, r.saldo_final ?? 0);

        return;
    }

    const reservado = r.costo ?? tarifa.reserva;

    // Las cabeceras salen ANTES de que vuelva la liquidacion, asi que llevan el
    // saldo POST-RESERVA (peor caso). Se corrigen solas; la fuente de verdad es
    // Supabase, que el frontend lee por realtime.
    res.setHeader('X-Creditos-Costo', String(reservado));
    if (r.saldo_final !== undefined) res.setHeader('X-Creditos-Saldo', String(r.saldo_final));

    anotar(res, { tarifa: tarifa.clave, costo: reservado, saldo: r.saldo_final });

    if (r.movimiento_id) {
        prepararCierre(res, {
            tarifa,
            movimientoId: r.movimiento_id,
            reservado,
            userId: req.user.id,
            cerrado: false,
        });
    }

    next();
};

/**
 * Engancha la liquidacion al final de la respuesta.
 *
 * prependListener y NO on: httpLogger ya registro su listener de 'finish' antes
 * (se monta antes en app.ts) y escribe la linea leyendo res.locals.logMeta.
 * Poniendonos al FRENTE de la cola, el anotar() de abajo corre sincrono antes de
 * que el logger lea, y la linea sale con el costo DEFINITIVO, no con el
 * reservado.
 */
function prepararCierre(res: Response, cobro: Cobro): void {
    res.locals.cobro = cobro;

    const cerrar = (abortada: boolean): void => {
        if (cobro.cerrado) return;   // 'finish' y 'close' disparan los dos
        cobro.cerrado = true;

        const meta = res.locals.logMeta ?? {};
        const status = abortada ? 499 : res.statusCode;
        // Sincrono: el coste final es funcion pura de (tarifa, status, origen).
        const final = abortada ? 0 : costoFinal(cobro.tarifa, status, meta.origen, meta.cobrar);

        anotar(res, { costo: final });   // <- lo que va a leer httpLogger

        if (final === cobro.reservado) return;   // nada que devolver

        // Fire-and-forget: la respuesta ya salio, esto no esta en el camino
        // critico. Si falla, la fila queda 'reservado' y la recoge el barrido.
        void liquidar(cobro, final, meta.origen);
    };

    res.prependListener('finish', () => cerrar(false));
    res.prependListener('close', () => cerrar(!res.writableEnded));
}

/** Modo log: no hay reserva que cerrar, solo se afina el costo del log. */
function prepararCierreSinCobro(res: Response, tarifa: Tarifa): void {
    let hecho = false;

    const cerrar = (abortada: boolean): void => {
        if (hecho) return;
        hecho = true;

        const meta = res.locals.logMeta ?? {};
        const status = abortada ? 499 : res.statusCode;

        anotar(res, { costo: abortada ? 0 : costoFinal(tarifa, status, meta.origen, meta.cobrar) });
    };

    res.prependListener('finish', () => cerrar(false));
    res.prependListener('close', () => cerrar(!res.writableEnded));
}

async function liquidar(cobro: Cobro, final: number, origen?: string): Promise<void> {
    for (let intento = 1; intento <= 2; intento++) {
        try {
            await rpc('creditos_liquidar', {
                p_movimiento_id: cobro.movimientoId,
                p_costo_real: final,
                p_origen: origen ?? null,
                p_meta: null,
            });

            return;
        } catch (e) {
            if (intento === 2) {
                logCred.error(
                    { err: e, movimientoId: cobro.movimientoId, userId: cobro.userId,
                      reservado: cobro.reservado, final },
                    'NO se pudo liquidar: el usuario quedo cobrado de mas, lo devolvera el barrido',
                );

                return;
            }

            await new Promise((r) => setTimeout(r, 250));
        }
    }
}

function rechaza402(
    req: Request,
    res: Response,
    motivo: string,
    costo: number,
    saldo?: number,
): void {
    const detalle = motivo === 'saldo_insuficiente'
        ? `Esta consulta cuesta ${costo} credito(s) y te quedan ${saldo ?? 0}.`
        : motivo === 'usuario_desconocido'
            ? 'Tu usuario todavia no tiene una cuenta de creditos.'
            : motivo === 'sin_usuario'
                ? 'No se pudo identificar al usuario de la peticion.'
                : 'El servicio de creditos no esta disponible.';

    res.setHeader('X-Creditos-Costo', String(costo));
    if (saldo !== undefined) res.setHeader('X-Creditos-Saldo', String(saldo));

    res.status(402).json({
        error: 'Saldo insuficiente',
        motivo,
        detalle,
        costo,
        saldo: saldo ?? 0,
        reqId: req.reqId,
    });

    // No se llama next(): la respuesta ya salio. La linea la escribe httpLogger
    // desde res.on('finish'), asi que el 402 SI queda registrado (a nivel warn).
}
