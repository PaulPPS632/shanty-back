import express, { Application } from 'express';
import cors from 'cors';
import routes from './routes';

export class App {
    public instance: Application;

    constructor() {
        this.instance = express();
        this.middlewares();
        this.routes();
    }

    private middlewares(): void {
        this.instance.use(cors());
        this.instance.use(express.json());
    }

    private routes(): void {
        this.instance.use('/api', routes);
    }

    listen(port: number | string): void {
        this.instance.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}
