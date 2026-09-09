import { Request, Response } from 'express';
import { FiltrosPadron, OrdenPadron, PadronService } from '../services/padronService';
import { anotar, logFallo } from '../middlewares/logMeta';

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
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }

    async getByDni(req: Request, res: Response): Promise<void> {
        try {
            const { dni } = req.params;
            const rows = await padronService.findByDni(dni);

            res.json(rows);
        } catch (error: any) {
            logFallo(req, res, error);
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
                anotar(res, { accion: 'padron.search', motivo: 'rango_edad_invalido' });
                res.status(400).json({ error: 'edadMin no puede ser mayor que edadMax' });
                return;
            }

            const ordenPedido = aTexto(body.orden) as OrdenPadron | undefined;

            if (ordenPedido && !ORDENES_VALIDOS.includes(ordenPedido)) {
                anotar(res, { accion: 'padron.search', motivo: 'orden_invalido' });
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

            const resultado = await padronService.buscar(filtros);

            anotar(res, {
                accion: 'padron.search',
                // Se anota `filtros`, no `body`: es lo que el servicio realmente uso
                // (ya pasado por aTexto/aEntero). Los undefined los descarta el
                // aplanado del logger, asi que solo salen los campos que se llenaron.
                q: {
                    dni: filtros.dni,
                    nombres: filtros.nombres,
                    paterno: filtros.paterno,
                    materno: filtros.materno,
                    dep: filtros.departamento_id,
                    prov: filtros.provincia_id,
                    dist: filtros.distrito_id,
                    edad: filtros.edadMin !== undefined || filtros.edadMax !== undefined
                        ? `${filtros.edadMin ?? ''}-${filtros.edadMax ?? ''}`
                        : undefined,
                    orden: filtros.orden,
                    pag: `${resultado.offset}+${resultado.limite}`,
                },
                resultados: resultado.resultados.length,
                total: resultado.total,
                // TOPE_CONTEO = 10 000: el '+' en el log significa "hay mas".
                totalAcotado: resultado.totalAcotado,
            });

            res.json(resultado);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }
}
