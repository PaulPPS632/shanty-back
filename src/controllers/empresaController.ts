import { Request, Response } from 'express';
import { EmpresaService } from '../services/empresaService';

const empresaService = new EmpresaService();

export class EmpresaController {
    async listar(req: Request, res: Response): Promise<void> {
        try {
            res.json(
                await empresaService.listar({
                    q: req.query.q as string,
                    limite: req.query.limite ? Number(req.query.limite) : undefined,
                    offset: req.query.offset ? Number(req.query.offset) : undefined,
                }),
            );
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
