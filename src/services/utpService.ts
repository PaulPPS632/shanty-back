import axios from 'axios';
import { Persona } from '../models';

const BASE_URL = 'https://api-docs-admision.utpxpedition.com/api';

// User-Agent usado por los endpoints autenticados (validateifexists, v2).
const AGENT_OPERA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0';

export class utpService {
    // Genera el token de acceso (JWT) contra el endpoint público.
    async jwtSession(): Promise<string> {
        const envio = await axios.get(`${BASE_URL}/public`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            },
        });
        return envio.data.data.accessToken;
    }

    // Obtiene la fecha de nacimiento del padrón local (formato YYYY-MM-DD).
    async fecha_nacimiento(dni: string): Promise<string> {
        try {
            const row = await Persona.findByPk(dni, { attributes: ['fecha_nac'], raw: true });
            if (!row || !row.fecha_nac) {
                throw new Error(`No se encontró fecha de nacimiento para el DNI: ${dni}`);
            }
            return row.fecha_nac; // DATEONLY ya viene 'YYYY-MM-DD'
        } catch (err: any) {
            throw new Error(`Error al obtener fecha de nacimiento para el DNI: ${dni}`);
        }
    }

    async dataalumno(dni: string): Promise<any> {
        try {
            const fecha_nac = await this.fecha_nacimiento(dni);
            const token = await this.jwtSession();

            const authHeaders = {
                'User-Agent': AGENT_OPERA,
                'User-Id': '',
                'User-Role': 'admin',
                authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            // 1) Verifica que el alumno exista -> registerid + documentNumber
            const exists = await axios.post(
                `${BASE_URL}/validates/validateifexists`,
                { documentType: '1', documentNumber: dni, birthdate: fecha_nac },
                { headers: authHeaders }
            );

            if (String(exists.data.status).toLowerCase() !== 'success') {
                throw new Error(exists.data.message || 'Alumno no encontrado');
            }

            const registerid = exists.data.data.registerid;
            const documentNumber = exists.data.data.documentNumber;

            // 2) Datos completos del alumno (v2)
            const v2 = await axios.post(
                `${BASE_URL}/validates/v2`,
                { ContactID: registerid, documentNumber },
                { headers: authHeaders }
            );
            const alumno = v2.data.data;

            // 3) Documentos del alumno. No es crítico: si falla, devolvemos igual los datos.
            let documentos: any = null;
            try {
                const docs = await axios.get(
                    `${BASE_URL}/documents/${alumno.registerid}/person/${alumno.contactoid}/applicant/${alumno.postulanteid}`,
                    {
                        headers: {
                            authorization: `Bearer ${token}`,
                            'user-id': '',
                            'user-role': 'admin',
                        },
                    }
                );
                documentos = docs.data;
            } catch (docErr: any) {
                console.error(`No se pudieron obtener documentos: ${docErr.message}`);
            }

            return { alumno, documentos };
        } catch (error: any) {
            console.error(`Error en dataalumno: ${error.message}`);
            throw new Error(`Error en dataalumno: ${error.message}`);
        }
    }
}
