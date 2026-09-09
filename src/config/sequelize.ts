import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';

import { LOG_SQL } from './env';   // el dotenv.config() vive ahi, no se repite aca
import { logDb } from './logger';

function recorta(sql: string): string {
    const limpio = sql.replace(/\s+/g, ' ').trim();

    return limpio.length > 500 ? `${limpio.slice(0, 500)}...` : limpio;
}

// Instancia Sequelize sobre la base PostgreSQL. Unica conexion del backend.
// Reutiliza las mismas variables de entorno DB_*.
// Los modelos NO se pasan aca: se registran en models/index.ts con
// sequelize.addModels(...) para evitar un import circular config <-> models.
export const sequelize = new Sequelize(
    process.env.DB_DATABASE as string,
    process.env.DB_USER as string,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        // Apagado por defecto: sobre 37M filas las consultas generadas son de varios
        // KB y taparian por completo la linea de la busqueda. Hacen falta LOG_SQL=true
        // Y LOG_LEVEL=debug, asi que no se puede encender por accidente.
        logging: LOG_SQL ? (sql: string, ms?: number) => logDb.debug({ ms }, recorta(sql)) : false,
        benchmark: LOG_SQL,   // hace que el 2do argumento sea el tiempo en ms
        define: {
            timestamps: false,   // las tablas no tienen createdAt/updatedAt
            freezeTableName: true,
        },
    }
);
