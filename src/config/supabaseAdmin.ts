import { SUPABASE_RPC_TIMEOUT_MS, SUPABASE_SECRET_KEY, SUPABASE_URL } from './env';
import { logCred } from './logger';

export type MotivoRpc = 'config' | 'timeout' | 'red' | 'http' | 'postgrest' | 'formato';

export class ErrorRpc extends Error {
    constructor(
        public readonly motivo: MotivoRpc,
        mensaje: string,
        public readonly estado?: number,
    ) {
        super(mensaje);
        this.name = 'ErrorRpc';
    }
}

// Cabeceras fijas: se arman una vez, no por llamada. La secret key va en las dos
// (apikey la usa el gateway de Supabase; Authorization la usa PostgREST para
// elegir el rol de Postgres). Este objeto NUNCA se loguea.
let cabeceras: Record<string, string> | null = null;

function headers(): Record<string, string> {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
        throw new ErrorRpc('config', 'Falta SUPABASE_URL o SUPABASE_SECRET_KEY');
    }

    cabeceras ??= {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        // Sin esto PostgREST devuelve un ARRAY de un elemento para una funcion
        // que devuelve TABLE(...). Con esto, el objeto directamente.
        Accept: 'application/vnd.pgrst.object+json',
    };

    return cabeceras;
}

/**
 * Llama a una funcion de Postgres via PostgREST.
 *
 * NO reintenta: el reintento lo decide quien llama, porque `creditos_reservar`
 * solo es idempotente gracias a p_idem_key y quien llama es el que sabe si ya
 * la mando.
 */
export async function rpc<T>(
    nombre: string,
    args: Record<string, unknown>,
    msTimeout = SUPABASE_RPC_TIMEOUT_MS,
): Promise<T> {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${nombre}`;
    let r: Response;

    try {
        r = await fetch(url, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(msTimeout),
        });
    } catch (e) {
        // AbortSignal.timeout aborta con name 'TimeoutError'; el resto es red.
        if (e instanceof Error && e.name === 'TimeoutError') {
            throw new ErrorRpc('timeout', `${nombre} no respondio en ${msTimeout}ms`);
        }

        throw new ErrorRpc('red', `${nombre}: ${e instanceof Error ? e.message : String(e)}`);
    }

    const texto = await r.text();

    if (!r.ok) {
        // PostgREST devuelve {code,message,details,hint}. El `message` puede traer
        // datos de la fila, asi que se registra pero no se propaga al cliente.
        let detalle = texto.slice(0, 300);

        try {
            const j = JSON.parse(texto) as { message?: string; code?: string };

            if (j.message) detalle = `${j.code ?? ''} ${j.message}`.trim();
        } catch {
            /* cuerpo no-JSON, se deja el recorte */
        }

        throw new ErrorRpc(r.status >= 500 ? 'http' : 'postgrest', `${nombre}: ${detalle}`, r.status);
    }

    try {
        return JSON.parse(texto) as T;
    } catch {
        throw new ErrorRpc('formato', `${nombre} no devolvio JSON: ${texto.slice(0, 120)}`);
    }
}

/**
 * Sonda de arranque, igual que precargarJwks(). Convierte "todos los cobros
 * fallan y nadie sabe por que" en un WARN en el arranque, y de paso deja la
 * conexion TLS caliente para el primer cobro real.
 */
export async function precargarCreditos(): Promise<void> {
    if (!SUPABASE_SECRET_KEY) return;

    try {
        const t0 = Date.now();

        await rpc<unknown>('creditos_ping', {});
        logCred.info({ ms: Date.now() - t0 }, 'RPC de creditos alcanzable');
    } catch (e) {
        logCred.warn({ err: e }, 'No se pudo contactar el RPC de creditos; se reintentara por peticion');
    }
}
