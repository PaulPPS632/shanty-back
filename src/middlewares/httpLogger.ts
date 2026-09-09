import type { Request, RequestHandler } from 'express';

import { logHttp } from '../config/logger';
import type { LogMeta } from './logMeta';

// Nunca se vuelcan al log, aunque hoy ningun endpoint los reciba: asi un campo nuevo
// en un body no se puede filtrar por descuido.
const PROHIBIDOS = /pass|token|secret|apikey|api_key|authorization|cookie|credential/i;

// Rutas de relleno de la UI: se disparan solas al abrir la pantalla y no son "una
// busqueda que hizo alguien". Van a debug para no tapar lo que importa.
const RUIDO: RegExp[] = [
    /^\/api\/ubigeo\//,
    /^\/api\/padron\/photo-cached\//,
    /^\/api\/foto$/,
    /^\/api\/health$/,
];

const MAX_LARGO_VALOR = 60;
const MAX_CAMPOS = 10;

/** Objeto -> pares clave=valor cortos, seguros e imprimibles. */
function aplana(origen: unknown): Record<string, string> {
    const salida: Record<string, string> = {};

    if (!origen || typeof origen !== 'object') return salida;

    for (const [k, v] of Object.entries(origen as Record<string, unknown>)) {
        if (Object.keys(salida).length >= MAX_CAMPOS) break;
        if (PROHIBIDOS.test(k)) continue;
        if (v === undefined || v === null || v === '') continue;
        if (typeof v === 'object') continue;   // arrays y objetos anidados no aportan

        const s = String(v);

        salida[k] = s.length > MAX_LARGO_VALOR ? `${s.slice(0, MAX_LARGO_VALOR)}...` : s;
    }

    return salida;
}

function corto(id: string): string {
    return id.slice(0, 8);
}

function quien(req: Request): string {
    if (req.user) return `${req.user.email ?? 'sin-email'} (${corto(req.user.id)})`;

    return req.authError ? `anon (${req.authError})` : 'anon';
}

function resumen(meta: LogMeta): string {
    const partes: string[] = [];

    if (meta.resultados !== undefined) {
        const total = meta.total !== undefined
            ? `/${meta.total}${meta.totalAcotado ? '+' : ''}`
            : '';

        partes.push(`${meta.resultados}${total} res`);
    } else if (meta.total !== undefined) {
        partes.push(`${meta.total}${meta.totalAcotado ? '+' : ''} res`);
    }

    if (meta.origen) partes.push(`origen=${meta.origen}`);
    // Solo aparece si la ruta esta en la tabla de precios. 'costo=0' significa
    // "de pago pero salio de cache"; la ausencia significa "ruta libre".
    if (meta.costo !== undefined) partes.push(`costo=${meta.costo}`);
    if (meta.saldo !== undefined) partes.push(`saldo=${meta.saldo}`);
    if (meta.motivo) partes.push(`motivo=${meta.motivo}`);

    return partes.length ? ` -> ${partes.join(' ')}` : '';
}

export const httpLogger: RequestHandler = (req, res, next) => {
    let escrita = false;

    const escribe = (abortada: boolean): void => {
        if (escrita) return;

        escrita = true;

        const ms = Number(process.hrtime.bigint() - req.startedAt) / 1e6;
        const meta: LogMeta = res.locals.logMeta ?? {};
        // 499 es la convencion de nginx: el cliente corto antes de la respuesta.
        const status = abortada ? 499 : res.statusCode;

        // Si el controlador anoto `q`, manda lo suyo: ya viene normalizado y con
        // nombres cortos. Si no, se refleja lo que llego crudo.
        const q = meta.q
            ? { ...aplana(req.params), ...aplana(meta.q) }
            : { ...aplana(req.params), ...aplana(req.query), ...aplana(req.body) };

        const ruta = req.originalUrl.split('?')[0];

        const nivel: 'error' | 'warn' | 'info' | 'debug' =
            status >= 500 ? 'error'
                : status >= 400 ? 'warn'
                    // Una peticion que costo creditos nunca es ruido, aunque su
                    // ruta este en RUIDO (foto, photo-cached ahora se cobran).
                    : (meta.costo ?? 0) > 0 ? 'info'
                        : meta.nivel === 'debug' || req.method === 'OPTIONS' || RUIDO.some((r) => r.test(ruta)) ? 'debug'
                            : 'info';

        const textoQ = Object.entries(q).map(([k, v]) => `${k}=${v}`).join(' ');

        const linea = [
            req.method.padEnd(4),
            ruta.padEnd(30),
            String(status).padEnd(3),
            `${ms.toFixed(0)}ms`.padStart(6),
            `user=${quien(req)}`,
            `ip=${req.ip ?? '-'}`,
            textoQ ? `[${textoQ}]` : '',
        ].filter(Boolean).join(' ') + resumen(meta);

        logHttp[nivel](
            {
                http: {
                    reqId: req.reqId,
                    method: req.method,
                    path: ruta,
                    query: req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : undefined,
                    status,
                    ms: Number(ms.toFixed(1)),
                    ip: req.ip,
                    ua: req.get('user-agent'),
                    user: req.user ? { id: req.user.id, email: req.user.email } : null,
                    authError: req.authError,
                    q,
                    ...meta,
                },
            },
            linea,
        );
    };

    // 'finish' = la respuesta se envio entera. 'close' cubre el caso de que el
    // cliente corte a medias, donde 'finish' no llega a dispararse.
    res.on('finish', () => escribe(false));
    res.on('close', () => escribe(!res.writableEnded));

    next();
};
