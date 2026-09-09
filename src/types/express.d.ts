import type { ClaimsUsuario, MotivoAuth } from '../config/supabaseJwt';
import type { Cobro } from '../middlewares/creditos';
import type { LogMeta } from '../middlewares/logMeta';

declare global {
    namespace Express {
        // @types/express-serve-static-core@5 declara estas interfaces vacias justo
        // para esto.
        interface Request {
            /** uuid v4 de la peticion. Lo pone requestContext, siempre existe. */
            reqId: string;
            /** process.hrtime.bigint() al entrar. Lo pone requestContext. */
            startedAt: bigint;
            /** Solo si el token verifico. */
            user?: ClaimsUsuario;
            /** Por que NO hay user. En AUTH_MODE=log la peticion pasa igual. */
            authError?: MotivoAuth;
        }

        interface Locals {
            /** Lo que el controlador quiere que salga en la linea del log. */
            logMeta?: LogMeta;
            /** Reserva viva de creditos. La pone el middleware de cobro. */
            cobro?: Cobro;
        }
    }
}

export {};
