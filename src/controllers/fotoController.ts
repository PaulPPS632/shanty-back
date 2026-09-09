import { Request, Response } from 'express';
import { FotoService } from '../services/fotoService';
import { anotar, logFallo } from '../middlewares/logMeta';

const fotoService = new FotoService();

export class FotoController {
    async getFoto(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.query;

            if (!dni) {
                res.status(400).json({ error: "Missing 'valor1' query parameter" });
                return;
            }

            const foto = await fotoService.fetchAndStorePhoto(dni as string);

            // Este endpoint SIEMPRE sale a RENIEC, tenga o no resultado.
            anotar(res, { accion: 'foto', q: { dni: dni as string }, origen: 'reniec' });

            if (foto) {
                anotar(res, { resultados: 1 });
                res.json({ foto });
            } else {
                anotar(res, { resultados: 0, motivo: 'sin_foto' });
                res.status(404).json({ error: "Photo not found in external API response" });
            }
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCachedPhoto(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const r = await fotoService.getCachedOrFetchPhoto(dni);

            if (!r.ok) {
                anotar(res, { accion: 'foto.cache', q: { dni }, motivo: r.motivo, resultados: 0 });
                res.status(404).json({
                    error: r.motivo === 'sin_persona'
                        ? 'User not found in padron'
                        : 'Photo not found in external API',
                });
                return;
            }

            // `origen` es lo que decide el precio: 'db' sale gratis, 'reniec' cobra.
            anotar(res, { accion: 'foto.cache', q: { dni }, origen: r.origen, resultados: 1 });
            res.json({ foto: r.foto });
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }
}
