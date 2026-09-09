import { Request, Response } from 'express';
import { MotivoFallo, RucService } from '../services/rucService';
import { anotar, logFallo } from '../middlewares/logMeta';

const rucService = new RucService();

// invalido -> culpa del cliente; sin_resultados -> no existe; conexion -> falla SUNAT.
const STATUS_POR_MOTIVO: Record<MotivoFallo, number> = {
    invalido: 400,
    sin_resultados: 404,
    conexion: 502,
    saturado: 503,
};

export class RucController {
    async getByRuc(req: Request, res: Response): Promise<void> {
        try {
            // Por defecto NO se sale a SUNAT si el RUC ya esta en `empresas`.
            // ?refrescar=1 fuerza la reconsulta y actualiza la fila.
            const refrescar = req.query.refrescar === '1' || req.query.refrescar === 'true';
            const resultado = await rucService.consultarRuc(req.params.ruc, refrescar);

            const q = { ruc: req.params.ruc, refrescar: refrescar || undefined };

            if (!resultado.ok) {
                // MotivoFallo: invalido | conexion | sin_resultados | saturado.
                // 'saturado' es la cola interna llena; verlo en el log es la senal
                // de que SUNAT esta throttleando.
                anotar(res, { accion: 'ruc.consulta', q, motivo: resultado.motivo, resultados: 0 });
                res.status(STATUS_POR_MOTIVO[resultado.motivo]).json({ error: resultado.error });
                return;
            }

            anotar(res, {
                accion: 'ruc.consulta',
                q,
                // Mismo valor que la cabecera X-Origen. 'db' = no se toco la red.
                origen: resultado.origen,
                resultados: 1,
            });

            // Cabecera informativa: 'db' = salio de la tabla empresas (sin red).
            res.set('X-Origen', resultado.origen);
            res.json(resultado.ficha);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }
}
