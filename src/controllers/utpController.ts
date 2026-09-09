import { Request, Response } from 'express';
import { utpService } from '../services/utpService';
import { logFallo } from '../middlewares/logMeta';

const utpServiceInstance = new utpService();
export class utpController {
    async getalumno(req: Request, res: Response): Promise<void> {
        await utpServiceInstance.dataalumno(req.params.dni)
            .then((data) => {
                res.json(data);
            })
            .catch((error) => {
                logFallo(req, res, error);
                res.status(500).json({ error: error.message });
            });
    }
}
