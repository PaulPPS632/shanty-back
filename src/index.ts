import { App } from './app';
import { PORT } from './config/env';
import { sequelize } from './models';

// Se importa sequelize desde './models' (no desde './config/sequelize') para que
// el addModels() corra antes de que el server empiece a atender requests.
async function main(): Promise<void> {
    await sequelize.authenticate();
    console.log('DB conectada:', (sequelize.config as any).database);

    const app = new App();
    app.listen(PORT);
}

main().catch((err: any) => {
    console.error('No se pudo conectar a la DB:', err.message);
    process.exit(1);
});
