import { Request, Response } from 'express';
import { TelefonoService, normalizaTelefono, LIMITE_DEFECTO, LIMITE_MAXIMO } from '../services/telefonoService';
import { anotar, logFallo } from '../middlewares/logMeta';

const telefonoService = new TelefonoService();

export class TelefonoController {
    async getByDni(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const rows = await telefonoService.findByDni(dni);
            res.json(rows);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }

    // Busqueda inversa por numero. Exige el numero completo: la coincidencia
    // parcial no puede usar el indice y haria seq scan sobre 80M filas.
    async buscar(req: Request, res: Response): Promise<void> {
        try {
            const numero = normalizaTelefono(req.query.telefono as string);

            if (!numero) {
                anotar(res, { accion: 'telefono.buscar', motivo: 'sin_telefono' });
                res.status(400).json({ error: 'Falta el parametro telefono' });
                return;
            }

            if (numero.length < 6 || numero.length > 12) {
                anotar(res, { accion: 'telefono.buscar', q: { telefono: numero }, motivo: 'largo_invalido' });
                res.status(400).json({ error: 'El telefono debe tener entre 6 y 12 digitos' });
                return;
            }

            const limite = Math.min(Number(req.query.limite) || LIMITE_DEFECTO, LIMITE_MAXIMO);
            const offset = Math.max(Number(req.query.offset) || 0, 0);

            const resultado = await telefonoService.buscarPorTelefono(numero, limite, offset);

            anotar(res, {
                accion: 'telefono.buscar',
                // `numero` ya normalizado: entra '+51 913-380-781', se loguea
                // '913380781', que es lo que de verdad fue contra el indice.
                q: { telefono: numero, pag: `${offset}+${limite}` },
                resultados: resultado.resultados.length,
                total: resultado.total,   // DNIs distintos con ese numero
            });

            res.json(resultado);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }

    async getByRuc(req: Request, res: Response): Promise<void> {
        try {
            const { ruc } = req.params;
            const rows = await telefonoService.findByRuc(ruc);
            res.json(rows);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }
}
