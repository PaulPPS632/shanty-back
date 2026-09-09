import dotenv from 'dotenv';

dotenv.config();

// --------------------------------------------------------------------------- //
// Lectores
// --------------------------------------------------------------------------- //

function str(nombre: string, porDefecto = ''): string {
    return (process.env[nombre] ?? porDefecto).trim();
}

function bool(nombre: string, porDefecto = false): boolean {
    const v = str(nombre).toLowerCase();

    if (!v) return porDefecto;

    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function unaDe<T extends string>(nombre: string, validos: readonly T[], porDefecto: T): T {
    const v = str(nombre).toLowerCase() as T;

    return validos.includes(v) ? v : porDefecto;
}

function lista(nombre: string, porDefecto = ''): string[] {
    return str(nombre, porDefecto)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

// --------------------------------------------------------------------------- //
// Servidor
// --------------------------------------------------------------------------- //

export const PORT = process.env.PORT || 3000;

// NODE_ENV no se setea en ningun lado (ni Dockerfile ni compose). Se deduce de como
// se esta corriendo: bajo ts-node-dev este archivo es .ts, compilado en dist/ es .js.
export const NODE_ENV = str('NODE_ENV') || (__filename.endsWith('.js') ? 'production' : 'development');

// Bearer token for the external campaigns API (was hardcoded in source before this refactor).
// Set EXTERNAL_CAMPAIGNS_TOKEN in .env.
export const EXTERNAL_CAMPAIGNS_TOKEN = str('EXTERNAL_CAMPAIGNS_TOKEN');

// --------------------------------------------------------------------------- //
// Logs
// --------------------------------------------------------------------------- //

export const LOG_LEVEL = unaDe(
    'LOG_LEVEL',
    ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const,
    'info',
);
export const LOG_FORMAT = unaDe('LOG_FORMAT', ['pretty', 'json'] as const, 'pretty');
export const LOG_SQL = bool('LOG_SQL', false);

// --------------------------------------------------------------------------- //
// CORS
// --------------------------------------------------------------------------- //

// Lista blanca de origenes. Vacia = se refleja el origen que venga, que es el
// comportamiento del `cors()` pelado de antes. En cuanto se sepa el dominio del
// frontend conviene ponerlo aca: evita que un sitio cualquiera reproduzca un token
// filtrado desde un contexto de navegador.
export const CORS_ORIGINS = lista('CORS_ORIGINS');

// --------------------------------------------------------------------------- //
// Proxy
// --------------------------------------------------------------------------- //

// El contenedor publica en 127.0.0.1:3400 y delante hay un nginx/caddy: sin esto
// req.ip es siempre la gateway del bridge de docker (172.x.0.1).
export const TRUST_PROXY: boolean | number | string = (() => {
    const v = str('TRUST_PROXY', '1');

    if (v === 'false' || v === '0') return false;
    if (v === 'true') return true;

    const n = Number(v);

    return Number.isInteger(n) ? n : v;   // 'loopback', '10.0.0.0/8', ...
})();

// --------------------------------------------------------------------------- //
// Auth (Supabase)
// --------------------------------------------------------------------------- //

export const AUTH_MODE = unaDe('AUTH_MODE', ['off', 'log', 'enforce'] as const, 'log');

export const SUPABASE_URL = str('SUPABASE_URL').replace(/\/+$/, '');
export const SUPABASE_JWT_ISSUER = str('SUPABASE_JWT_ISSUER')
    || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : '');
export const SUPABASE_JWKS_URL = str('SUPABASE_JWKS_URL')
    || (SUPABASE_JWT_ISSUER ? `${SUPABASE_JWT_ISSUER}/.well-known/jwks.json` : '');
export const SUPABASE_JWT_AUD = str('SUPABASE_JWT_AUD', 'authenticated');
// Solo proyectos legacy: si el JWKS devuelve {"keys":[]}.
export const SUPABASE_JWT_SECRET = str('SUPABASE_JWT_SECRET');

export const AUTH_PUBLIC_PATHS = lista('AUTH_PUBLIC_PATHS', '/api/health');

// --------------------------------------------------------------------------- //
// Creditos
// --------------------------------------------------------------------------- //

// off     = no se toca nada, ni una llamada a Supabase. Igual que hoy.
// log     = se calcula la tarifa y se CONSULTA el saldo, se anota en el log,
//           pero NO se descuenta y NUNCA se responde 402.
// enforce = reserva -> 402 si no alcanza -> liquidacion.
export const CREDITS_MODE = unaDe('CREDITS_MODE', ['off', 'log', 'enforce'] as const, 'off');

// Clave SECRETA de Supabase (Settings -> API Keys -> Secret keys, sb_secret_...).
// NO es la publishable: con esa, todos los RPC dan permission denied.
export const SUPABASE_SECRET_KEY = str('SUPABASE_SECRET_KEY')
    || str('SUPABASE_SERVICE_ROLE_KEY');   // alias del formato legacy

// Techo por llamada RPC. 4 s es generoso: es un UPDATE de una fila. Si tarda
// mas es que Supabase esta caido, y para eso esta CREDITS_FAIL_OPEN.
export const SUPABASE_RPC_TIMEOUT_MS = Number(str('SUPABASE_RPC_TIMEOUT_MS', '4000')) || 4000;

// Si el RPC falla o expira: true = se sirve la peticion sin cobrar.
export const CREDITS_FAIL_OPEN = bool('CREDITS_FAIL_OPEN', true);

// Prefijos que nunca cobran ni gastan un RPC. Misma semantica que
// AUTH_PUBLIC_PATHS: prefijo, no exacto.
export const CREDITS_FREE_PATHS = lista('CREDITS_FREE_PATHS', '/api/health,/api/ubigeo,/api/creditos');

// Una peticion que acabo en >=400 no cobra. Ponlo en true para cobrar los 404
// de SUNAT/RENIEC, que si consumieron una llamada externa real.
export const CREDITS_CHARGE_ON_ERROR = bool('CREDITS_CHARGE_ON_ERROR', false);

// Cada cuanto se relee creditos_config.precios desde Supabase.
export const CREDITS_PRECIOS_TTL_MS = Number(str('CREDITS_PRECIOS_TTL_MS', '60000')) || 60000;

/**
 * `sb_secret_...` (formato nuevo) o un JWT cuyo payload trae role=service_role.
 * Con la publishable key TODOS los RPC dan permission denied y el backend falla
 * abierto sin cobrarle a nadie: un error carisimo de diagnosticar en runtime.
 */
function pareceSecretKey(k: string): boolean {
    if (k.startsWith('sb_secret_')) return true;
    if (k.startsWith('sb_publishable_')) return false;

    try {
        const payload = JSON.parse(Buffer.from(k.split('.')[1] ?? '', 'base64url').toString());

        return payload.role === 'service_role';
    } catch {
        return false;
    }
}

/** Se llama al arrancar: mejor morir con un mensaje claro que servir 401 a todos. */
export function validarConfig(): void {
    // OJO: sin `return` temprano. Antes salia aqui si AUTH_MODE era 'off' y las
    // comprobaciones de creditos no habrian corrido nunca.
    if (AUTH_MODE !== 'off' && !SUPABASE_JWKS_URL && !SUPABASE_JWT_SECRET) {
        throw new Error(
            `AUTH_MODE=${AUTH_MODE} pero no hay ni SUPABASE_URL ni SUPABASE_JWT_SECRET. `
            + 'Define SUPABASE_URL=https://<ref>.supabase.co en el .env, o AUTH_MODE=off.',
        );
    }

    if (CREDITS_MODE === 'off') return;

    if (!SUPABASE_URL) {
        throw new Error(`CREDITS_MODE=${CREDITS_MODE} exige SUPABASE_URL (de ahi sale el /rest/v1).`);
    }

    if (!SUPABASE_SECRET_KEY) {
        throw new Error(
            `CREDITS_MODE=${CREDITS_MODE} exige SUPABASE_SECRET_KEY `
            + '(Supabase -> Settings -> API Keys -> Secret keys).',
        );
    }

    if (!pareceSecretKey(SUPABASE_SECRET_KEY)) {
        throw new Error(
            'SUPABASE_SECRET_KEY no parece una clave de servicio (las nuevas empiezan por '
            + 'sb_secret_; las JWT llevan role=service_role). Con la publishable key los RPC '
            + 'de creditos no tienen permiso y nadie pagaria nada.',
        );
    }

    // Sin token no hay a quien cobrarle: con AUTH_MODE=log bastaria con no mandar
    // Authorization para no pagar.
    if (CREDITS_MODE === 'enforce' && AUTH_MODE !== 'enforce') {
        throw new Error('CREDITS_MODE=enforce exige AUTH_MODE=enforce.');
    }
}
