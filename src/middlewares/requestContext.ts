import { randomUUID } from 'crypto';

import type { RequestHandler } from 'express';

export const requestContext: RequestHandler = (req, res, next) => {
    // Si el proxy ya puso un id se respeta, asi la linea de nginx y la de la API se
    // pueden cruzar. En nginx: proxy_set_header X-Request-Id $request_id;
    const entrante = req.get('x-request-id');

    req.reqId = entrante && /^[\w.:-]{8,64}$/.test(entrante) ? entrante : randomUUID();
    req.startedAt = process.hrtime.bigint();

    res.setHeader('X-Request-Id', req.reqId);

    next();
};
