import { App } from './app';
import { AUTH_MODE, CREDITS_MODE, LOG_LEVEL, NODE_ENV, PORT, validarConfig } from './config/env';
import { flushLogs, logger } from './config/logger';
import { refrescarPrecios } from './config/precios';
import { precargarCreditos } from './config/supabaseAdmin';
import { precargarJwks } from './config/supabaseJwt';
import { sequelize } from './models';

// Se importa sequelize desde './models' (no desde './config/sequelize') para que
// el addModels() corra antes de que el server empiece a atender requests.
async function main(): Promise<void> {
    validarConfig();

    await sequelize.authenticate();
    logger.info(
        {
            db: (sequelize.config as any).database,
            env: NODE_ENV,
            authMode: AUTH_MODE,
            creditsMode: CREDITS_MODE,
            logLevel: LOG_LEVEL,
        },
        'DB conectada',
    );

    await precargarJwks();

    if (CREDITS_MODE !== 'off') {
        await precargarCreditos();
        await refrescarPrecios(true);
    }

    new App().listen(PORT);
}

// node corre como PID 1 en el contenedor y PID 1 NO tiene handlers de senal por
// defecto: sin esto `docker compose stop` espera 10 s y mata a lo bruto, perdiendo
// lo que pino tenga en el buffer.
for (const s of ['SIGTERM', 'SIGINT'] as const) {
    process.on(s, () => {
        logger.info({ signal: s }, 'Apagando');
        flushLogs();
        process.exit(0);
    });
}

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    flushLogs();
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, 'unhandledRejection');
});

main().catch((err: any) => {
    logger.fatal({ err }, `No se pudo arrancar: ${err.message}`);
    flushLogs();
    process.exit(1);
});
