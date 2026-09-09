import type { Request, Response } from 'express';

import { logger } from '../config/logger';

export interface LogMeta {
    /** La operacion en terminos de dominio: 'padron.search', 'ruc.consulta'. */
    accion?: string;
    /** Terminos de busqueda YA NORMALIZADOS, tal como los uso el servicio. */
    q?: Record<string, unknown>;
    /** Filas devueltas en esta pagina. */
    resultados?: number;
    /** Coincidencias totales (mayor que `resultados` si hay paginado). */
    total?: number;
    /** true si `total` viene recortado (padron corta el conteo en 10 000). */
    totalAcotado?: boolean;
    /** De donde salio el dato: 'db' | 'sunat' | 'cache' | 'api'. */
    origen?: string;
    /** Fallo esperado, no excepcion: 'invalido', 'saturado', 'sin_resultados'. */
    motivo?: string;
    /** Baja la linea a debug aunque la ruta no este en la lista de ruido. */
    nivel?: 'debug' | 'info';

    // ---- creditos ---------------------------------------------------------
    /** Clave de la tarifa aplicada: 'ruc', 'foto.cache'. Lo pone el middleware. */
    tarifa?: string;
    /** Creditos cobrados de verdad. 0 = gratis (cache, error o ruta libre). */
    costo?: number;
    /** Saldo del usuario. En enforce es el saldo POST-RESERVA. */
    saldo?: number;
    /**
     * ENTRADA, no salida: coste definitivo puesto a mano por un controlador
     * cuando `origen` no basta. Se recorta a [0, reserva].
     */
    cobrar?: number;
}

/**
 * Acumula sobre lo que ya hubiera. Se puede llamar varias veces en el mismo
 * handler (p.ej. una para los filtros y otra para el resultado).
 */
export function anotar(res: Response, meta: LogMeta): void {
    res.locals.logMeta = { ...(res.locals.logMeta ?? {}), ...meta };
}

/**
 * Para los catch de los controladores. Sustituye al `console.error(error)` suelto:
 * manda el stack a pino (estructurado, con reqId) y marca la linea del httpLogger
 * con motivo=excepcion. NO responde: cada controlador sigue eligiendo su status.
 */
export function logFallo(req: Request, res: Response, error: unknown): void {
    anotar(res, { motivo: 'excepcion' });

    logger.error(
        { err: error, http: { reqId: req.reqId, method: req.method, path: req.originalUrl } },
        `EXCEPCION ${req.method} ${req.originalUrl}: ${(error as any)?.message ?? error}`,
    );
}
