import { Request, Response } from 'express';
import { FotoService } from '../services/fotoService';

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

            if (foto) {
                res.json({ foto });
            } else {
                res.status(404).json({ error: "Photo not found in external API response" });
            }
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCachedPhoto(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const foto = await fotoService.getCachedOrFetchPhoto(dni);

            if (foto === undefined) {
                res.status(404).json({ error: 'User not found in padron' });
                return;
            }

            if (foto) {
                res.json({ foto });
            } else {
                res.status(404).json({ error: "Photo not found in external API" });
            }
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
