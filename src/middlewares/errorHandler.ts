import type { ErrorRequestHandler, RequestHandler } from 'express';

import { logger } from '../config/logger';

export const notFound: RequestHandler = (req, res) => {
    // OJO: se registra con app.use(notFound), SIN string de ruta. En Express 5
    // (path-to-regexp v8) `app.use('*', ...)` revienta en el arranque.
    res.status(404).json({
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        reqId: req.reqId,
    });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    // Express 5 reenvia aca las promesas rechazadas de los handlers, cosa que
    // Express 4 no hacia. Hoy los controladores tienen su propio try/catch, asi que
    // esto es la red de seguridad para lo que se escape.
    const status = Number(err?.status ?? err?.statusCode) || 500;

    logger.error(
        { err, http: { reqId: req.reqId, method: req.method, path: req.originalUrl, status } },
        `EXCEPCION ${req.method} ${req.originalUrl}: ${err?.message ?? err}`,
    );

    if (res.headersSent) {
        next(err);

        return;
    }

    res.status(status).json({
        // Hacia afuera no se filtra el mensaje interno de un 500.
        error: status >= 500 ? 'Error interno' : String(err?.message ?? 'Error'),
        reqId: req.reqId,
    });
};
