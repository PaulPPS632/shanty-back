import { Request, Response } from 'express';
import { UbigeoService } from '../services/ubigeoService';

const ubigeoService = new UbigeoService();

export class UbigeoController {
    async getDepartamentos(req: Request, res: Response): Promise<void> {
        try {
            res.json(await ubigeoService.departamentos());
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getProvincias(req: Request, res: Response): Promise<void> {
        try {
            res.json(await ubigeoService.provincias(req.query.departamento_id as string));
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getDistritos(req: Request, res: Response): Promise<void> {
        try {
            res.json(
                await ubigeoService.distritos(
                    req.query.provincia_id as string,
                    req.query.departamento_id as string,
                ),
            );
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
