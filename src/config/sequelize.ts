import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Instancia Sequelize sobre la base PostgreSQL. Unica conexion del backend.
// Reutiliza las mismas variables de entorno DB_*.
export const sequelize = new Sequelize(
    process.env.DB_DATABASE as string,
    process.env.DB_USER as string,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
        define: {
            timestamps: false,   // las tablas no tienen createdAt/updatedAt
            freezeTableName: true,
        },
    }
);
