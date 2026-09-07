import tls from 'tls';
import fs from 'fs';
import path from 'path';

export interface EmpleoDB {
    RUC_TRABAJO: string;
    FechaInicio: string;
    FechaFin: string;          // fecha 'DD/MM/YYYY' o el literal 'VIGENTE'
    RazonSocial: string | null;
    ActividadEconomica: string | null;
    Ocupacion: string | null;
    MotivoBaja: string | null;
}

const HOST = 'apps.trabajo.gob.pe';

// Lee el header 'api-th' desde src/keys/key.txt (equivalente a leer_valor_encabezado del Python).
function leerApiTh(): string {
    const rutaKey = path.join(__dirname, '..', 'keys', 'key.txt');
    return fs.readFileSync(rutaKey, 'utf-8').trim();
}

// El valor de 'api-th' contiene bytes de control (0x0f-0x18) que Node prohíbe en headers
// (ERR_INVALID_CHAR). Python/requests los deja pasar y el servidor los exige, así que
// enviamos la petición por un socket TLS crudo, componiendo el request a mano.
// Seguro: el valor no contiene CR/LF, por lo que no puede romper el framing HTTP.
function rawHttpsGet(pathReq: string, apiTh: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({ host: HOST, port: 443, servername: HOST }, () => {
            const req =
                `GET ${pathReq} HTTP/1.1\r\n` +
                `Host: ${HOST}\r\n` +
                `api-th: ${apiTh}\r\n` +
                `Referer: https://apps.trabajo.gob.pe/clisegurovida/app/\r\n` +
                `User-Agent: node-raw-client\r\n` +
                `Accept: application/json\r\n` +
                `Connection: close\r\n\r\n`;
            socket.write(req, 'latin1'); // latin1: 1 byte por code unit, preserva 0x0f-0x18
        });

        const chunks: Buffer[] = [];
        socket.on('data', (d: Buffer) => chunks.push(d));
        socket.on('error', reject);
        socket.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const sep = raw.indexOf('\r\n\r\n');
            if (sep === -1) return reject(new Error('Respuesta HTTP malformada'));

            const head = raw.slice(0, sep);
            let body = raw.slice(sep + 4);

            const status = parseInt(head.split('\r\n')[0].split(' ')[1] || '0', 10);

            // Dechunk si viene Transfer-Encoding: chunked
            if (/transfer-encoding:\s*chunked/i.test(head)) {
                body = dechunk(body);
            }

            if (status < 200 || status >= 300) {
                return reject(new Error(`MTPE respondió HTTP ${status}`));
            }
            resolve(body);
        });
    });
}

function dechunk(body: string): string {
    let out = '';
    let i = 0;
    while (i < body.length) {
        const nl = body.indexOf('\r\n', i);
        if (nl === -1) break;
        const size = parseInt(body.slice(i, nl).trim(), 16);
        if (!size) break;
        out += body.slice(nl + 2, nl + 2 + size);
        i = nl + 2 + size + 2;
    }
    return out;
}

export class TrabajoService {
    // Consulta planillas del MTPE (Seguro Vida Ley) por DNI.
    async consultarEmpleos(dni: string): Promise<EmpleoDB[]> {
        const pathReq = `/apisegurovida/api/consult/planilla?tipodoc=03&numeDoc=${encodeURIComponent(dni)}`;
        const body = await rawHttpsGet(pathReq, leerApiTh());

        // El Python decide "sin empleos" si el texto no contiene "v_numruc".
        if (!body.includes('v_numruc')) {
            return [];
        }

        let data: any;
        try {
            data = JSON.parse(body);
        } catch {
            return [];
        }

        if (!Array.isArray(data)) {
            return [];
        }

        return data.map((k: any) => ({
            RUC_TRABAJO: k.v_numruc,
            FechaInicio: k.d_fecini,
            FechaFin: k.d_fecfin,
            RazonSocial: k.v_razsoc ?? null,
            ActividadEconomica: k.v_actecono ?? null,
            Ocupacion: k.v_ocupacion ?? null,
            MotivoBaja: k.v_motivobaja ?? null,
        }));
    }
}
