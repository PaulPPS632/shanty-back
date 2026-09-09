import { CREDITS_CHARGE_ON_ERROR, CREDITS_PRECIOS_TTL_MS } from './env';
import { logCred } from './logger';
import { rpc } from './supabaseAdmin';

export interface Tarifa {
    /** Clave estable. Es la que aparece en creditos_config.precios y en el log. */
    clave: string;
    metodo: 'GET' | 'POST' | '*';
    /** Plantilla estilo Express. Se compila a regex case-insensitive. */
    ruta: string;
    /** Lo que se RESERVA: SIEMPRE el peor caso. La liquidacion solo devuelve. */
    reserva: number;
    /**
     * Precio final segun LogMeta.origen. Si la clave no esta, se cobra `reserva`.
     * Es el mismo `origen` que los controladores ya anotan.
     */
    porOrigen?: Record<string, number>;
    /** true = si el RPC de creditos falla, se rechaza en vez de servir gratis. */
    fallaCerrado?: boolean;
}

interface Compilada extends Tarifa {
    re: RegExp;
    /** Nombres de los :params, en el orden de los grupos de captura del regex. */
    nombres: string[];
}

/**
 * Express enruta case-INsensitive y tolera la barra final: los defaults de
 * 'case sensitive routing' y 'strict routing' vienen apagados. Verificado:
 *
 *   /api/foto  200    /API/FOTO  200    /api/foto/  200    /API/Foto/  200
 *
 * Los cuatro ejecutan el handler que paga RENIEC. Si esta tabla no replica ese
 * comportamiento, cambiar una letra a mayuscula salta la tarifa: un bypass de
 * un caracter. De ahi el flag 'i' y el /?$ final.
 *
 * req.path no viene percent-decodificado, igual que lo que matchea el router de
 * Express, asi que los dos coinciden y /api/%66oto da 404 en vez de colarse.
 */
function compilar(plantilla: string): { re: RegExp; nombres: string[] } {
    const nombres: string[] = [];
    const cuerpo = plantilla
        .split('/')
        .filter(Boolean)
        .map((seg) => {
            if (seg === '*') return '.*';

            if (seg.startsWith(':')) {
                nombres.push(seg.slice(1));

                return '([^/]+)';
            }

            return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/');

    return { re: new RegExp(`^/${cuerpo}/?$`, 'i'), nombres };
}

// ORDEN IMPORTANTE: gana la primera que casa. Lo especifico antes que lo
// generico (photo-cached antes que cualquier regla /api/padron).
//
// Los numeros de aqui son solo el ARRANQUE: creditos_config.precios los pisa en
// cuanto responde Supabase, asi que una tarifa se cambia con un UPDATE y sin
// desplegar. La estructura (que rutas hay, cuales son condicionales, que claves
// de origen tienen) vive en codigo porque es lo que se revisa en un commit.
const BASE: readonly Tarifa[] = [
    // --- Plomeria: nunca cobra, y ni siquiera gasta un RPC. ---
    { clave: 'health',        metodo: 'GET',  ruta: '/api/health',               reserva: 0 },
    { clave: 'creditos',      metodo: 'GET',  ruta: '/api/creditos',             reserva: 0 },
    { clave: 'ubigeo',        metodo: 'GET',  ruta: '/api/ubigeo/*',             reserva: 0 },

    // --- Condicionales: se reserva el peor caso y se devuelve si salio de cache. ---
    // 'db' = Empresa.findByPk, cero red. 'sunat' = una ranura de la cola serial
    // de 1.1 s + riesgo de que el WAF banee la IP del VPS para todos.
    { clave: 'ruc',           metodo: 'GET',  ruta: '/api/ruc/:ruc',
      reserva: 2, porOrigen: { db: 0, sunat: 2 } },
    // 'db' = personas.foto ya guardada. 'reniec' = POST a sis.itp.gob.pe.
    { clave: 'foto.cache',    metodo: 'GET',  ruta: '/api/padron/photo-cached/:dni',
      reserva: 3, porOrigen: { db: 0, reniec: 3 } },

    // --- Siempre de pago: cada llamada sale a un tercero. ---
    // RENIEC sin cola, sin cache y sin timeout: el endpoint mas abusable y el
    // dato mas sensible. Si el sistema de creditos cae, este NO se regala.
    { clave: 'foto',          metodo: 'GET',  ruta: '/api/foto',                 reserva: 3, fallaCerrado: true },
    { clave: 'utp',           metodo: 'GET',  ruta: '/api/utpalumno/:dni',       reserva: 4, fallaCerrado: true },
    { clave: 'trabajo',       metodo: 'GET',  ruta: '/api/trabajo',              reserva: 2 },
    { clave: 'campanias',     metodo: 'GET',  ruta: '/api/external-campaigns',   reserva: 1 },
    { clave: 'cupones.pdf',   metodo: 'GET',  ruta: '/api/coupons-pdf',          reserva: 2 },
    { clave: 'cupones.50',    metodo: 'GET',  ruta: '/api/coupons/special-50',   reserva: 2 },

    // --- Lecturas de la BD local: baratas, pero son el producto. ---
    { clave: 'padron.search', metodo: 'POST', ruta: '/api/padron/search',        reserva: 1 },
    { clave: 'padron.dni',    metodo: 'GET',  ruta: '/api/padron/dni/:dni',      reserva: 1 },
    { clave: 'padron.nombre', metodo: 'GET',  ruta: '/api/padron/specific-name', reserva: 1 },
    { clave: 'telefonos',     metodo: 'GET',  ruta: '/api/telefonos/*',          reserva: 1 },
    { clave: 'empresas',      metodo: 'GET',  ruta: '/api/empresas',             reserva: 1 },
];

const TARIFAS: Compilada[] = BASE.map((t) => ({
    ...t,
    porOrigen: t.porOrigen ? { ...t.porOrigen } : undefined,
    ...compilar(t.ruta),
}));

/**
 * Devuelve la tarifa de una peticion, o null si la ruta no esta en la tabla.
 *
 * null = GRATIS a proposito: un endpoint nuevo nunca debe empezar a dar 402
 * porque alguien olvido anadirlo aqui. Queda en el log a nivel debug.
 */
export function tarifaDe(metodo: string, path: string): Tarifa | null {
    return TARIFAS.find((t) => (t.metodo === '*' || t.metodo === metodo) && t.re.test(path)) ?? null;
}

/**
 * Extrae los :params del path usando el regex de la tarifa.
 *
 * Hace falta porque este codigo corre en un middleware montado con app.use(),
 * ANTES del router: alli `req.params` esta VACIO y `req.route` es undefined, asi
 * que el :dni de /api/padron/dni/48810165 no se puede leer de otra forma.
 */
export function paramsDe(tarifa: Tarifa, path: string): Record<string, string> {
    const t = TARIFAS.find((x) => x.clave === tarifa.clave);

    if (!t || t.nombres.length === 0) return {};

    const m = t.re.exec(path);

    if (!m) return {};

    return Object.fromEntries(t.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1] ?? '')]));
}

/** El precio definitivo. Sincrono a proposito: se llama desde res.on('finish'). */
export function costoFinal(t: Tarifa, status: number, origen?: string, cobrar?: number): number {
    // Un controlador puede fijar el coste a mano, pero nunca por encima de lo
    // reservado: la liquidacion solo devuelve.
    if (cobrar !== undefined) return Math.max(0, Math.min(cobrar, t.reserva));

    if (!CREDITS_CHARGE_ON_ERROR && status >= 400) return 0;

    if (origen && t.porOrigen && origen in t.porOrigen) return t.porOrigen[origen]!;

    return t.reserva;
}

// --------------------------------------------------------------------------- //
// Precios desde la base
// --------------------------------------------------------------------------- //

let ultimaCarga = 0;
let cargando: Promise<void> | null = null;

function aplicar(precios: Record<string, unknown>): void {
    for (const t of TARIFAS) {
        const v = precios[t.clave];

        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) continue;

        if (t.porOrigen) {
            // La clave de la tabla fija el caso caro; los origenes baratos (db)
            // se mantienen. La reserva es SIEMPRE el maximo posible, o la
            // liquidacion tendria que cobrar de mas.
            for (const k of Object.keys(t.porOrigen)) {
                if (t.porOrigen[k] !== 0) t.porOrigen[k] = v;
            }
            t.reserva = Math.max(v, ...Object.values(t.porOrigen));
        } else {
            t.reserva = v;
        }
    }
}

/**
 * Relee creditos_config.precios con TTL. Fallo = se sigue con lo que hubiera:
 * un bache de Supabase no debe cambiar las tarifas de golpe.
 */
export async function refrescarPrecios(forzar = false): Promise<void> {
    if (!forzar && Date.now() - ultimaCarga < CREDITS_PRECIOS_TTL_MS) return;
    if (cargando) return cargando;

    cargando = (async () => {
        try {
            const valor = await rpc<Record<string, unknown> | null>('creditos_conf', {
                p_clave: 'precios',
                p_defecto: null,
            });

            if (valor && typeof valor === 'object') {
                aplicar(valor);
                logCred.debug({ precios: valor }, 'Precios recargados desde creditos_config');
            }

            ultimaCarga = Date.now();
        } catch (e) {
            logCred.warn({ err: e }, 'No se pudieron leer los precios; se sigue con los actuales');
            // ultimaCarga no se toca: se reintenta en la siguiente peticion.
        } finally {
            cargando = null;
        }
    })();

    return cargando;
}

/** Solo para el arranque y para GET /api/creditos. */
export function tarifasActuales(): Record<string, number> {
    return Object.fromEntries(TARIFAS.filter((t) => t.reserva > 0).map((t) => [t.clave, t.reserva]));
}
