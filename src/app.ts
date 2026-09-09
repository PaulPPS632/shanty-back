import cors, { type CorsOptions } from 'cors';
import express, { type Application } from 'express';

import { AUTH_MODE, CORS_ORIGINS, CREDITS_MODE, LOG_LEVEL, TRUST_PROXY } from './config/env';
import { logger } from './config/logger';
import { cobroCreditos } from './middlewares/creditos';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { httpLogger } from './middlewares/httpLogger';
import { requestContext } from './middlewares/requestContext';
import { supabaseAuth } from './middlewares/supabaseAuth';
import routes from './routes';

const opcionesCors: CorsOptions = {
    // CORS_ORIGINS vacio -> `true` refleja el origen que venga, que es lo mismo que
    // hacia el cors() pelado de antes. Con la lista puesta, solo esos.
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    // Explicito porque ahora el front manda Authorization. Sin la lista, cors()
    // reflejaba Access-Control-Request-Headers, que funcionaba pero era implicito.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    // Sin esto el navegador NO deja leer X-Origen cross-origin: no es un header
    // safelisted, asi que res.headers.get('X-Origen') devolvia null en el front.
    exposedHeaders: ['X-Origen', 'X-Request-Id', 'X-Creditos-Costo', 'X-Creditos-Saldo'],
    // Mandar Authorization convierte cada GET simple en uno con preflight. Sin
    // maxAge Chrome cachea el preflight solo 5 s, y el bucle de RUCs del front
    // pagaria un OPTIONS extra por cada RUC. 7200 es el techo de Chrome.
    maxAge: 7200,
};

export class App {
    public instance: Application;

    constructor() {
        this.instance = express();

        // Detras de nginx/caddy (compose publica en 127.0.0.1:3400). Sin esto req.ip
        // es la gateway del bridge de docker (172.x) en TODAS las lineas.
        this.instance.set('trust proxy', TRUST_PROXY);
        this.instance.disable('x-powered-by');

        this.middlewares();
        this.routes();
        this.errores();          // SIEMPRE despues de routes()
    }

    private middlewares(): void {
        // 1) Id y cronometro. Primero de todo: lo demas se apoya en req.reqId.
        this.instance.use(requestContext);

        // 2) Logger. Va ANTES de cors() y de supabaseAuth a proposito: los dos
        //    cortan la cadena (cors responde el preflight, auth responde el 401), y
        //    si fuera despues esas respuestas serian invisibles. Se registra aca
        //    pero ESCRIBE en res.on('finish'): para entonces req.body y req.user ya
        //    estan puestos.
        this.instance.use(httpLogger);

        // 3) CORS.
        this.instance.use(cors(opcionesCors));

        // 4) Body JSON. Solo /api/padron/search lo usa; el limite evita que un body
        //    de 100 MB se coma la memoria del contenedor.
        this.instance.use(express.json({ limit: '256kb' }));

        // 5) Auth. Despues del logger (para que el 401 quede registrado) y despues
        //    del parser (para que un handler publico ya tenga body).
        this.instance.use(supabaseAuth);

        // 6) Creditos. Despues de auth porque necesita req.user; despues de
        //    cors() porque un 402 sin Access-Control-Allow-Origin le llega al
        //    navegador como error de CORS opaco y el front no puede leer el
        //    cuerpo para decir "sin saldo"; despues del logger para que el 402
        //    quede registrado igual que el 401; y ANTES de las rutas porque la
        //    reserva ocurre antes de que el controlador ejecute nada.
        this.instance.use(cobroCreditos);
    }

    private routes(): void {
        // Sin auth: esta en AUTH_PUBLIC_PATHS por defecto.
        this.instance.get('/api/health', (_req, res) => {
            res.json({ ok: true });
        });

        this.instance.use('/api', routes);
    }

    private errores(): void {
        this.instance.use(notFound);
        this.instance.use(errorHandler);
    }

    listen(port: number | string): void {
        this.instance.listen(port, () => {
            logger.info(
                { port, authMode: AUTH_MODE, creditsMode: CREDITS_MODE, logLevel: LOG_LEVEL },
                `API escuchando en :${port}`,
            );
        });
    }
}
