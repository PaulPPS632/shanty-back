import { Request, Response } from 'express';
import { EmpresaService } from '../services/empresaService';
import { anotar, logFallo } from '../middlewares/logMeta';

const empresaService = new EmpresaService();

export class EmpresaController {
    async listar(req: Request, res: Response): Promise<void> {
        try {
            const filtros = {
                q: req.query.q as string,
                limite: req.query.limite ? Number(req.query.limite) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            };

            const listado = await empresaService.listar(filtros);

            anotar(res, {
                accion: 'empresa.listar',
                // Se usa la clave `q`, la misma del query string: asi la version
                // explicita pisa la refleja y no sale el campo dos veces.
                q: { q: filtros.q, pag: `${listado.offset}+${listado.limite}` },
                resultados: listado.resultados.length,
                total: listado.total,
            });

            res.json(listado);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }
}
