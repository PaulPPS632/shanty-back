import { Op } from 'sequelize';
import { Empresa } from '../models';

export interface FiltrosEmpresa {
    q?: string;        // texto libre: razon social o RUC
    limite?: number;
    offset?: number;
}

export interface ListadoEmpresas {
    total: number;
    limite: number;
    offset: number;
    resultados: any[];
}

export const LIMITE_DEFECTO = 20;
export const LIMITE_MAXIMO = 100;

// Listado de lo que ya se consulto alguna vez. La tabla se puebla sola con
// cada RUC nuevo que pasa por /api/ruc/:ruc.
export class EmpresaService {
    async listar(filtros: FiltrosEmpresa): Promise<ListadoEmpresas> {
        const limite = Math.min(Math.max(filtros.limite ?? LIMITE_DEFECTO, 1), LIMITE_MAXIMO);
        const offset = Math.max(filtros.offset ?? 0, 0);

        const q = (filtros.q ?? '').trim();
        const digitos = q.replace(/\D/g, '');

        // La condicion por RUC solo entra si el texto TIENE digitos: con `q`
        // alfabetico, `digitos` queda vacio y `ruc LIKE '%'` matchearia todo.
        const alternativas: any[] = [];

        if (q) alternativas.push({ razon_social: { [Op.iLike]: `%${q}%` } });
        if (digitos) alternativas.push({ ruc: { [Op.like]: `${digitos}%` } });

        const where = alternativas.length ? { [Op.or]: alternativas } : undefined;

        // La tabla es chica (crece de a un RUC por consulta nueva), asi que
        // aca si conviene un count exacto, a diferencia de `personas`.
        const { count, rows } = await Empresa.findAndCountAll({
            where: where as any,
            order: [['consultado_en', 'DESC']],
            limit: limite,
            offset,
            raw: true,
        });

        return { total: count, limite, offset, resultados: rows };
    }

    async contar(): Promise<number> {
        return Empresa.count();
    }
}
