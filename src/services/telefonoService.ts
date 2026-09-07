import { fn, col, literal, Op } from 'sequelize';
import { Persona, Telefono, TelefonoRuc } from '../models';

// Una misma linea aparece en varias filas de `telefonos`: unas traen `operador`
// y otras traen `plan` (y el periodo puede venir vacio). Por eso se agrupa por
// numero y se toma el primer valor no vacio de cada campo, en vez de devolver
// el volcado crudo (7 filas para 4 numeros reales, con huecos).
export interface TelefonoAgrupado {
    telefono: string;
    operador: string | null;
    plan: string | null;
    empresa: string | null;
    periodo: string | null;   // el mas reciente ('YYYY/MM', ordena bien como texto)
    registros: number;        // cuantas filas crudas respaldan este numero
}

export interface PersonaPorTelefono {
    persona: any;
    coincidencia: TelefonoAgrupado;
}

export interface BusquedaTelefono {
    telefono: string;
    total: number;                      // DNIs distintos que tienen el numero
    resultados: PersonaPorTelefono[];   // pagina actual
}

export const LIMITE_DEFECTO = 50;
export const LIMITE_MAXIMO = 200;

const AGRUPADO_ATTRS = [
    'telefono',
    [fn('max', fn('nullif', col('operador'), '')), 'operador'],
    [fn('max', fn('nullif', col('plan'), '')), 'plan'],
    [fn('max', fn('nullif', col('empresa'), '')), 'empresa'],
    [fn('max', fn('nullif', col('periodo'), '')), 'periodo'],
    [literal('COUNT(*)::int'), 'registros'],
] as any;

const ORDEN_AGRUPADO = [[fn('max', fn('nullif', col('periodo'), '')), 'DESC NULLS LAST']] as any;

const ORDEN_PERSONAS = [['paterno', 'ASC'], ['materno', 'ASC'], ['nombres', 'ASC'], ['dni', 'ASC']] as any;

// Deja solo digitos y quita el codigo de pais peruano. El input del buscador
// puede llegar como '+51 913 380 781', '913-380-781' o '51913380781'.
// Ningun numero local supera los 9 digitos, asi que 11 digitos que empiezan
// en 51 son codigo de pais + movil.
export function normalizaTelefono(valor: string): string {
    const digitos = (valor || '').replace(/\D/g, '');

    if (digitos.length > 9 && digitos.startsWith('51')) {
        return digitos.slice(2);
    }

    return digitos;
}

// Toma el primer valor no vacio de una columna entre las filas crudas del mismo numero.
function primerNoVacio(filas: any[], campo: string): string | null {
    for (const f of filas) {
        const v = (f[campo] ?? '').toString().trim();

        if (v) return v;
    }

    return null;
}

export class TelefonoService {
    // Telefonos de una persona natural, agrupados por numero.
    async findByDni(dni: string): Promise<TelefonoAgrupado[]> {
        return Telefono.findAll({
            where: { dni },
            attributes: AGRUPADO_ATTRS,
            group: ['telefono'],
            order: ORDEN_AGRUPADO,
            raw: true,
        }) as unknown as TelefonoAgrupado[];
    }

    // Busqueda inversa: numero -> personas que lo tienen registrado.
    // Solo coincidencia EXACTA: `telefonos_telefono_idx` es un btree y la base
    // usa collation en_US.UTF-8, asi que un `LIKE '95328%'` no puede usar el
    // indice y degenera en seq scan de 80M filas. El exacto resuelve en ~1.5 ms.
    //
    // Se pagina porque hay numeros basura en osiptel compartidos por cientos de
    // personas ('999999999' -> 255 DNIs, 165 KB sin limite).
    async buscarPorTelefono(telefono: string, limite = LIMITE_DEFECTO, offset = 0): Promise<BusquedaTelefono> {
        const numero = normalizaTelefono(telefono);
        const vacio: BusquedaTelefono = { telefono: numero, total: 0, resultados: [] };

        if (!numero) return vacio;

        // 1) indice por telefono
        const filas = await Telefono.findAll({ where: { telefono: numero }, raw: true }) as any[];

        if (filas.length === 0) return vacio;

        // 2) un mismo numero puede estar en varios DNI (reasignado, familiar, basura)
        const porDni = new Map<string, any[]>();

        for (const f of filas) {
            const lista = porDni.get(f.dni) ?? [];

            lista.push(f);
            porDni.set(f.dni, lista);
        }

        // 3) indice por PK, ordenado y paginado para que la pagina sea estable
        const personas = await Persona.findAll({
            where: { dni: { [Op.in]: Array.from(porDni.keys()) } },
            order: ORDEN_PERSONAS,
            limit: limite,
            offset,
            raw: true,
        }) as any[];

        const resultados = personas.map((persona) => {
            const propias = porDni.get(persona.dni) ?? [];
            const periodos = propias.map((f) => (f.periodo ?? '').trim()).filter(Boolean).sort();

            return {
                persona,
                coincidencia: {
                    telefono: numero,
                    operador: primerNoVacio(propias, 'operador'),
                    plan: primerNoVacio(propias, 'plan'),
                    empresa: primerNoVacio(propias, 'empresa'),
                    periodo: periodos.length ? periodos[periodos.length - 1] : null,
                    registros: propias.length,
                },
            };
        });

        return { telefono: numero, total: porDni.size, resultados };
    }

    // Mismo agrupado para telefonos ligados a RUC.
    async findByRuc(ruc: string): Promise<TelefonoAgrupado[]> {
        return TelefonoRuc.findAll({
            where: { ruc },
            attributes: AGRUPADO_ATTRS,
            group: ['telefono'],
            order: ORDEN_AGRUPADO,
            raw: true,
        }) as unknown as TelefonoAgrupado[];
    }
}
