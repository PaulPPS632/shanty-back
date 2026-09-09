import { Request, Response } from 'express';

import { rpc } from '../config/supabaseAdmin';
import { tarifasActuales } from '../config/precios';
import { anotar, logFallo } from '../middlewares/logMeta';

interface RespuestaSaldo {
    saldo: number;
    total_gastado: number;
    total_recibido: number;
    existe: boolean;
}

export class CreditosController {
    /**
     * Saldo del usuario autenticado. Es la via para clientes que no son el
     * navegador (curl, un smoke test); el frontend lee la tabla directo bajo
     * RLS y se suscribe por realtime, que es mas inmediato.
     */
    async getSaldo(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                anotar(res, { accion: 'creditos.saldo', motivo: 'sin_usuario' });
                res.status(401).json({ error: 'No autorizado', reqId: req.reqId });
                return;
            }

            const r = await rpc<RespuestaSaldo>('creditos_saldo_de', { p_user_id: req.user.id });

            anotar(res, { accion: 'creditos.saldo', saldo: r.saldo, nivel: 'debug' });
            res.json({ ...r, precios: tarifasActuales() });
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(502).json({ error: 'No se pudo consultar el saldo', reqId: req.reqId });
        }
    }
}
