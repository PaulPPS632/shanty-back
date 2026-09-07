import { Op, Order, WhereOptions } from 'sequelize';
import { Persona } from '../models';

export type OrdenPadron = 'nombre_asc' | 'nombre_desc' | 'edad_asc' | 'edad_desc';

export interface FiltrosPadron {
    dni?: string;
    nombres?: string;
    paterno?: string;
    materno?: string;
    departamento_id?: string;
    provincia_id?: string;
    distrito_id?: string;
    edadMin?: number;
    edadMax?: number;
    orden?: OrdenPadron;
    limite?: number;
    offset?: number;
}

export interface ResultadoPadron {
    total: number;
    totalAcotado: boolean;   // true si se corto el conteo en TOPE_CONTEO
    limite: number;
    offset: number;
    resultados: any[];
}

export const LIMITE_DEFECTO = 20;
export const LIMITE_MAXIMO = 100;

// Contar exacto sobre 37M filas puede costar segundos con filtros amplios
// (un departamento son ~12M personas). Se cuenta hasta este tope y se avisa
// con `totalAcotado` para que la UI muestre "10 000+".
export const TOPE_CONTEO = 10000;

// Replica lo que hizo el ETL con las columnas *_norm: upper(unaccent(...)).
// 'MUÑOZ' -> 'MUNOZ', 'DÍAZ' -> 'DIAZ'.
export function normalizaTexto(valor?: string | null): string {
    return (valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function escapaLike(valor: string): string {
    return valor.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Limite superior para emular `LIKE 'prefijo%'` con un rango indexable.
 * Incrementa el ultimo caracter CON ACARREO: 'VALZ' -> 'VAM'.
 *
 * Sin acarreo daria 'VAL[', y en collation en_US.UTF-8 la puntuacion ordena
 * ANTES de las letras, asi que el rango saldria vacio (medido: 0 filas contra
 * las 178 reales). Devuelve null cuando no hay limite seguro y solo queda el LIKE.
 */
export function limiteSuperior(prefijo: string): string | null {
    const chars = prefijo.split('');

    while (chars.length) {
        const ultimo = chars[chars.length - 1];

        // Se descarta lo que no se puede incrementar sin riesgo: la puntuacion
        // (incluido el espacio) ordena ANTES de las letras en en_US.UTF-8, asi
        // que incrementarla daria un rango vacio -> 'DE LA Z' pasa a 'DE LB'.
        if (!/[A-Y0-8]/.test(ultimo)) {
            chars.pop();
            continue;
        }

        chars[chars.length - 1] = String.fromCharCode(ultimo.charCodeAt(0) + 1);

        return chars.join('');
    }

    return null;   // prefijo tipo 'ZZZZ': no hay cota superior, solo la inferior
}

/**
 * Condicion de prefijo indexada. El rango (>=, <) es lo que usa el btree; el
 * LIKE queda como recheck exacto porque la collation ignora los espacios y el
 * rango llega a ser superconjunto ('DE LA C%': 156 305 por rango vs 155 265 reales).
 */
function condicionPrefijo(prefijo: string): Record<symbol, unknown> {
    const cond: Record<symbol, unknown> = {
        [Op.like]: `${escapaLike(prefijo)}%`,
        [Op.gte]: prefijo,          // siempre: sin esto 'ZZZZ' hacia seq scan (94 s medidos)
    };
    const tope = limiteSuperior(prefijo);

    if (tope) {
        cond[Op.lt] = tope;
    }

    return cond;
}

// Edad -> rango de fecha_nac. Se filtra por fecha para poder usar la columna
// indexable en vez de calcular la edad fila por fila.
function rangoFechaNac(edadMin?: number, edadMax?: number): Record<symbol, unknown> | null {
    const cond: Record<symbol, unknown> = {};
    const hoy = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    if (edadMax !== undefined) {
        // El dia que cumple edadMax+1 ya no entra: el limite inferior es el dia siguiente.
        const desde = new Date(Date.UTC(hoy.getUTCFullYear() - (edadMax + 1), hoy.getUTCMonth(), hoy.getUTCDate() + 1));

        cond[Op.gte] = iso(desde);
    }

    if (edadMin !== undefined) {
        const hasta = new Date(Date.UTC(hoy.getUTCFullYear() - edadMin, hoy.getUTCMonth(), hoy.getUTCDate()));

        cond[Op.lte] = iso(hasta);
    }

    return Object.getOwnPropertySymbols(cond).length ? cond : null;
}

// El orden por nombre coincide con personas_paterno_norm_materno_norm_nombres_idx,
// asi que Postgres recorre el indice ya ordenado y corta en el LIMIT (~0.6 ms).
// El orden por edad obliga a un sort del conjunto filtrado: con un departamento
// entero son ~2.5 s. Se deja disponible, pero el default es por nombre.
const ORDENES: Record<OrdenPadron, Order> = {
    nombre_asc: [['paterno_norm', 'ASC'], ['materno_norm', 'ASC'], ['nombres', 'ASC'], ['dni', 'ASC']],
    nombre_desc: [['paterno_norm', 'DESC'], ['materno_norm', 'DESC'], ['nombres', 'DESC'], ['dni', 'DESC']],
    edad_desc: [['fecha_nac', 'ASC'], ['dni', 'ASC']],   // mas viejo primero
    edad_asc: [['fecha_nac', 'DESC'], ['dni', 'ASC']],   // mas joven primero
};

export class PadronService {
    // Query de debug preexistente: un nombre fijo. Se mantiene por compatibilidad.
    async findSpecificName(): Promise<any[]> {
        return Persona.findAll({
            where: { nombres: 'ABRAHAM STEVE', paterno: 'CANEZ', materno: 'GIL' },
            raw: true,
        });
    }

    async findByDni(dni: string): Promise<any[]> {
        return Persona.findAll({ where: { dni: normalizaDni(dni) }, raw: true });
    }

    private construyeWhere(filtros: FiltrosPadron): WhereOptions {
        const where: Record<string, unknown> = {};

        const dni = normalizaDni(filtros.dni);

        if (dni) where.dni = dni;

        const paterno = normalizaTexto(filtros.paterno);
        const materno = normalizaTexto(filtros.materno);
        const nombres = normalizaTexto(filtros.nombres);

        if (paterno) where.paterno_norm = condicionPrefijo(paterno);
        if (materno) where.materno_norm = condicionPrefijo(materno);
        if (nombres) where.nombres = condicionPrefijo(nombres);

        if (filtros.distrito_id) where.distrito_id = filtros.distrito_id;
        if (filtros.provincia_id) where.provincia_id = filtros.provincia_id;
        if (filtros.departamento_id) where.departamento_id = filtros.departamento_id;

        const fecha = rangoFechaNac(filtros.edadMin, filtros.edadMax);

        if (fecha) where.fecha_nac = fecha;

        return where as WhereOptions;
    }

    async buscar(filtros: FiltrosPadron): Promise<ResultadoPadron> {
        const where = this.construyeWhere(filtros);
        const limite = Math.min(Math.max(filtros.limite ?? LIMITE_DEFECTO, 1), LIMITE_MAXIMO);
        const offset = Math.max(filtros.offset ?? 0, 0);
        const orden = ORDENES[filtros.orden ?? 'nombre_asc'] ?? ORDENES.nombre_asc;

        // Conteo acotado: se piden solo los DNI y sin ORDER BY, asi resuelve por
        // indice. Reusa el mismo `where` para no duplicar la logica en SQL crudo.
        const [paraConteo, resultados] = await Promise.all([
            Persona.findAll({ where, attributes: ['dni'], limit: TOPE_CONTEO + 1, raw: true }),
            Persona.findAll({ where, order: orden, limit: limite, offset, raw: true }),
        ]);

        return {
            total: Math.min(paraConteo.length, TOPE_CONTEO),
            totalAcotado: paraConteo.length > TOPE_CONTEO,
            limite,
            offset,
            resultados,
        };
    }
}

// Los DNI estan guardados con 8 digitos y ceros a la izquierda.
export function normalizaDni(valor?: string | null): string {
    const digitos = (valor || '').replace(/\D/g, '');

    if (!digitos) return '';

    return digitos.length < 8 ? digitos.padStart(8, '0') : digitos;
}
