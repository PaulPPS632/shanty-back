import { Request, Response } from 'express';
import { PadronService } from '../services/padronService';

const padronService = new PadronService();

export class PadronController {
    async getSpecificName(req: Request, res: Response): Promise<void> {
        try {
            const rows = await padronService.findSpecificName();
            res.json(rows);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getByDni(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const rows = await padronService.findByDni(dni);
            res.json(rows);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async search(req: Request, res: Response): Promise<void> {
        try {
            const { nombres, paterno, materno, dni } = req.query;
            const rows = await padronService.search({
                nombres: nombres as string,
                paterno: paterno as string,
                materno: materno as string,
                dni: dni as string,
            });
            res.json(rows);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
