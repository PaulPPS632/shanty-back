import { Request, Response } from 'express';
import { FiltrosPadron, OrdenPadron, PadronService } from '../services/padronService';

const padronService = new PadronService();

const ORDENES_VALIDOS: OrdenPadron[] = ['nombre_asc', 'nombre_desc', 'edad_asc', 'edad_desc'];

// Los numeros llegan como string desde JSON; se ignoran los no numericos.
function aEntero(valor: unknown): number | undefined {
    if (valor === undefined || valor === null || valor === '') return undefined;

    const n = Number(valor);

    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function aTexto(valor: unknown): string | undefined {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

export class PadronController {
    async getSpecificName(req: Request, res: Response): Promise<void> {
        try {
            const rows = await padronService.findSpecificName();

            res.json(rows);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getByDni(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const rows = await padronService.findByDni(dni);

            res.json(rows);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    // POST porque el filtro ya no cabe comodo en la query string: nombre,
    // ubigeo en 3 niveles, rango de edad, orden y paginado.
    async search(req: Request, res: Response): Promise<void> {
        try {
            const body = (req.body ?? {}) as Record<string, unknown>;

            const edadMin = aEntero(body.edadMin);
            const edadMax = aEntero(body.edadMax);

            if (edadMin !== undefined && edadMax !== undefined && edadMin > edadMax) {
                res.status(400).json({ error: 'edadMin no puede ser mayor que edadMax' });
                return;
            }

            const ordenPedido = aTexto(body.orden) as OrdenPadron | undefined;

            if (ordenPedido && !ORDENES_VALIDOS.includes(ordenPedido)) {
                res.status(400).json({ error: `orden invalido. Use: ${ORDENES_VALIDOS.join(', ')}` });
                return;
            }

            const filtros: FiltrosPadron = {
                dni: aTexto(body.dni),
                nombres: aTexto(body.nombres),
                paterno: aTexto(body.paterno),
                materno: aTexto(body.materno),
                departamento_id: aTexto(body.departamento_id),
                provincia_id: aTexto(body.provincia_id),
                distrito_id: aTexto(body.distrito_id),
                edadMin,
                edadMax,
                orden: ordenPedido,
                limite: aEntero(body.limite),
                offset: aEntero(body.offset),
            };

            res.json(await padronService.buscar(filtros));
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
