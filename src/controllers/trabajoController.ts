import { Request, Response } from 'express';
import { TrabajoService } from '../services/trabajoService';

const trabajoService = new TrabajoService();

export class TrabajoController {
    async getEmpleos(req: Request, res: Response): Promise<void> {
        try {
            const dni = req.query.dni as string;

            if (!dni) {
                res.status(400).json({ Mensaje: 'No se envió un DNI' });
                return;
            }

            const empleos = await trabajoService.consultarEmpleos(dni);

            if (empleos.length === 0) {
                res.json({ Mensaje: 'El usuario no registra empleos actualmente' });
                return;
            }

            res.json(empleos);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
