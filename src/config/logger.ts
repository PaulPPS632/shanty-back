import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

import { LOG_FORMAT, LOG_LEVEL, NODE_ENV } from './env';

// Sin pid ni hostname: dentro de un contenedor de un solo proceso son ruido fijo
// que se repite en cada linea.
const opciones: LoggerOptions = {
    level: LOG_LEVEL,
    base: { env: NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Red de seguridad: aunque hoy ningun endpoint reciba estos campos, un dia
    // alguien loguea un body entero y el token de Supabase acaba en el log.
    redact: {
        paths: [
            'http.headers.authorization',
            'req.headers.authorization',
            'req.headers.cookie',
            '*.access_token',
            '*.refresh_token',
            '*.password',
            // La secret key de Supabase. `config.headers` importa porque axios
            // adjunta la config de la peticion a los errores que lanza.
            '*.apikey',
            '*.supabaseKey',
            'config.headers.apikey',
            'config.headers.authorization',
        ],
        remove: true,
    },
};

function destino(): DestinationStream {
    if (LOG_FORMAT === 'json') {
        // 1 = stdout. sync:false bufferiza; por eso index.ts hace flush al morir.
        return pino.destination({ dest: 1, sync: false });
    }

    // `require` en vez de `import`: pino-pretty exporta la funcion como default Y
    // como named segun la version, y asi no dependemos de como lo resuelva
    // esModuleInterop. El tipo se fija a mano porque solo se usa como stream.
    // OJO: pino-pretty va en `dependencies`, no en devDependencies. El Dockerfile
    // hace `npm install --only=production` y si no, revienta aca en el arranque.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pretty = require('pino-pretty') as (o: Record<string, unknown>) => DestinationStream;

    return pretty({
        // Forzado a true: `docker logs` no es un TTY, y pino-pretty apaga el color
        // solo cuando no detecta uno. Sin esto la salida sale en gris.
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        // Todo el detalle estructurado va bajo `http`. En modo pretty la linea
        // legible ya lo lleva dentro de `msg`, asi que se oculta el objeto y no sale
        // duplicado. `err` NO esta en la lista: los stacks si se imprimen.
        ignore: 'env,http,comp',
        singleLine: true,
        errorLikeObjectKeys: ['err', 'error'],
    });
}

export const logger: Logger = pino(opciones, destino());

// Hijos con contexto fijo, para no repetir `comp` en cada llamada.
export const logHttp = logger.child({ comp: 'http' });
export const logAuth = logger.child({ comp: 'auth' });
export const logDb = logger.child({ comp: 'db' });
export const logCred = logger.child({ comp: 'cred' });

// Con sync:false pino bufferiza. Si el proceso muere sin vaciar se pierden las
// ultimas lineas, que son justo las del crash.
export function flushLogs(): void {
    try {
        (logger as unknown as { flush?: () => void }).flush?.();
    } catch {
        /* el proceso ya se esta muriendo, no hay nada que hacer */
    }
}
