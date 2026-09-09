import { createSecretKey, type KeyObject } from 'crypto';

import {
    createRemoteJWKSet,
    decodeProtectedHeader,
    errors as joseErrors,
    jwtVerify,
    type JWTPayload,
    type JWTVerifyGetKey,
} from 'jose';   // jose@5: es CJS. jose@6 es ESM-only y no se puede require() aca.

import {
    SUPABASE_JWKS_URL,
    SUPABASE_JWT_AUD,
    SUPABASE_JWT_ISSUER,
    SUPABASE_JWT_SECRET,
} from './env';
import { logAuth } from './logger';

export interface ClaimsUsuario {
    /** `sub` del JWT. Mismo valor que `favoritos.user_id` en Supabase. */
    id: string;
    email: string | null;
    role: string | null;
}

export type MotivoAuth =
    | 'sin_token' | 'formato' | 'expirado' | 'firma'
    | 'issuer' | 'audiencia' | 'sin_sub' | 'config' | 'jwks';

export class ErrorAuth extends Error {
    constructor(public readonly motivo: MotivoAuth, mensaje: string) {
        super(mensaje);
        this.name = 'ErrorAuth';
    }
}

// --------------------------------------------------------------------------- //
// Claves
// --------------------------------------------------------------------------- //

let jwks: JWTVerifyGetKey | null = null;

function claveRemota(): JWTVerifyGetKey {
    if (jwks) return jwks;

    if (!SUPABASE_JWKS_URL) {
        throw new ErrorAuth('config', 'Falta SUPABASE_URL / SUPABASE_JWKS_URL');
    }

    // createRemoteJWKSet cachea y, cuando ve un `kid` que no conoce, vuelve a bajar
    // el JWKS (con cooldown para que no sea un vector de DoS). Eso es lo que hace
    // que una rotacion de claves en Supabase no rompa nada: ni redeploy, ni
    // reinicio, ni cambio de variable.
    jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL), {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
    });

    return jwks;
}

let secreto: KeyObject | null = null;

function claveSimetrica(): KeyObject {
    if (!SUPABASE_JWT_SECRET) {
        throw new ErrorAuth(
            'config',
            'El token viene firmado en HS256 (proyecto legacy) pero SUPABASE_JWT_SECRET esta vacio',
        );
    }

    if (!secreto) secreto = createSecretKey(Buffer.from(SUPABASE_JWT_SECRET, 'utf8'));

    return secreto;
}

// --------------------------------------------------------------------------- //
// Verificacion
// --------------------------------------------------------------------------- //

export async function verificarToken(token: string): Promise<ClaimsUsuario> {
    let alg: string | undefined;

    try {
        alg = decodeProtectedHeader(token).alg;
    } catch {
        throw new ErrorAuth('formato', 'La cadena no es un JWT');
    }

    const comunes = {
        issuer: SUPABASE_JWT_ISSUER || undefined,
        audience: SUPABASE_JWT_AUD || undefined,
        clockTolerance: 5,   // segundos: el reloj del VPS contra el de Supabase
    };

    try {
        // Se rama por algoritmo con listas blancas DISJUNTAS. No hay confusion de
        // algoritmos posible: cada rama usa material de clave distinto (un secreto
        // HMAC vs una clave publica EC) y nunca se cruzan.
        const { payload } = alg === 'HS256'
            ? await jwtVerify(token, claveSimetrica(), { ...comunes, algorithms: ['HS256'] })
            : await jwtVerify(token, claveRemota(), { ...comunes, algorithms: ['ES256', 'RS256'] });

        return aClaims(payload);
    } catch (e) {
        throw traduce(e);
    }
}

function aClaims(p: JWTPayload): ClaimsUsuario {
    const sub = typeof p.sub === 'string' ? p.sub : '';

    if (!sub) throw new ErrorAuth('sin_sub', 'El token no trae `sub`');

    // Supabase pone el email en el claim raiz. En sesiones de Google OAuth / One Tap
    // a veces solo aparece dentro de user_metadata.
    const meta = (p.user_metadata ?? {}) as Record<string, unknown>;
    const email = (typeof p.email === 'string' && p.email)
        || (typeof meta.email === 'string' && meta.email)
        || null;

    return { id: sub, email, role: typeof p.role === 'string' ? p.role : null };
}

function traduce(e: unknown): ErrorAuth {
    if (e instanceof ErrorAuth) return e;

    if (e instanceof joseErrors.JWTExpired) {
        return new ErrorAuth('expirado', 'El token expiro');
    }

    if (e instanceof joseErrors.JWTClaimValidationFailed) {
        if (e.claim === 'iss') return new ErrorAuth('issuer', `Issuer inesperado (se espera ${SUPABASE_JWT_ISSUER})`);
        if (e.claim === 'aud') return new ErrorAuth('audiencia', `Audience inesperado (se espera ${SUPABASE_JWT_AUD})`);

        return new ErrorAuth('firma', e.message);
    }

    if (e instanceof joseErrors.JWKSNoMatchingKey) {
        return new ErrorAuth('jwks', 'Ninguna clave del JWKS corresponde al kid del token');
    }

    if (e instanceof joseErrors.JOSEError) return new ErrorAuth('firma', e.message);

    return new ErrorAuth('jwks', e instanceof Error ? e.message : 'Fallo al verificar el token');
}

// --------------------------------------------------------------------------- //
// Diagnostico de arranque
// --------------------------------------------------------------------------- //

/**
 * Baja el JWKS una vez al arrancar. No es obligatorio (jose lo baja solo en la
 * primera peticion), pero convierte "todo el mundo recibe 401 y nadie sabe por que"
 * en una linea de WARN en el arranque.
 */
export async function precargarJwks(): Promise<void> {
    if (!SUPABASE_JWKS_URL) return;

    try {
        const r = await fetch(SUPABASE_JWKS_URL, { signal: AbortSignal.timeout(5_000) });
        const body = (await r.json()) as { keys?: Array<{ kid?: string; alg?: string }> };
        const keys = body.keys ?? [];

        if (keys.length === 0) {
            logAuth.warn(
                { jwks: SUPABASE_JWKS_URL, secretoConfigurado: Boolean(SUPABASE_JWT_SECRET) },
                'El JWKS de Supabase esta VACIO: el proyecto sigue en modo legacy HS256. '
                + 'Hay que definir SUPABASE_JWT_SECRET o los tokens no se van a poder verificar.',
            );

            return;
        }

        logAuth.info(
            { jwks: SUPABASE_JWKS_URL, claves: keys.map((k) => `${k.kid}:${k.alg}`) },
            `JWKS de Supabase cargado (${keys.length} clave/s)`,
        );
    } catch (e) {
        logAuth.warn({ err: e }, 'No se pudo precargar el JWKS; se reintentara en la primera peticion');
    }
}
