import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AUTH_MODE, AUTH_PUBLIC_PATHS } from '../config/env';
import { ErrorAuth, verificarToken } from '../config/supabaseJwt';

function esPublica(path: string): boolean {
    return AUTH_PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export const supabaseAuth: RequestHandler = async (req, res, next) => {
    // El preflight del navegador NUNCA lleva Authorization. Si se le responde 401,
    // el navegador aborta la peticion real y el front entero deja de funcionar con
    // un error de CORS que no dice nada. Esto tiene que ir primero, antes incluso de
    // mirar AUTH_MODE.
    if (req.method === 'OPTIONS') {
        next();

        return;
    }

    if (AUTH_MODE === 'off' || esPublica(req.path)) {
        next();

        return;
    }

    const cabecera = req.get('authorization') ?? '';

    if (!cabecera) {
        rechaza(req, res, next, new ErrorAuth('sin_token', 'Falta la cabecera Authorization'));

        return;
    }

    const [esquema, token] = cabecera.split(' ');

    if (!/^bearer$/i.test(esquema ?? '') || !token) {
        rechaza(req, res, next, new ErrorAuth('formato', 'Se espera: Authorization: Bearer <access_token>'));

        return;
    }

    try {
        req.user = await verificarToken(token);
        next();
    } catch (e) {
        rechaza(req, res, next, e instanceof ErrorAuth ? e : new ErrorAuth('firma', String(e)));
    }
};

function rechaza(req: Request, res: Response, next: NextFunction, err: ErrorAuth): void {
    // Se guarda SIEMPRE, tambien en modo log: es lo que hace que la linea diga
    // `user=anon (expirado)` en vez de un `anon` mudo.
    req.authError = err.motivo;

    if (AUTH_MODE !== 'enforce') {
        // Modo 'log': pasa igual. Permite desplegar el backend antes que el frontend
        // y medir cuanto trafico sigue llegando sin token.
        next();

        return;
    }

    res.set('WWW-Authenticate', 'Bearer realm="shanty-api", error="invalid_token"');
    res.status(401).json({
        error: 'No autorizado',
        motivo: err.motivo,
        detalle: err.message,
        reqId: req.reqId,
    });

    // No se llama next(): la respuesta ya salio. La linea del log la escribe
    // httpLogger desde res.on('finish'), no desde el final de la cadena, asi que la
    // 401 SI queda registrada.
}
