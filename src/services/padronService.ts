import { pool } from '../config/db';

export interface PadronSearchParams {
    nombres?: string;
    paterno?: string;
    materno?: string;
    dni?: string;
}

export class PadronService {
    async findSpecificName(): Promise<any[]> {
        const query = `
            SELECT * FROM padron_raw pr
            WHERE pr.nombres = 'ABRAHAM STEVE'
            AND pr.paterno = 'CANEZ'
            AND pr.materno = 'GIL'
        `;
        const result = await pool.query(query);
        return result.rows;
    }

    async findByDni(dni: string): Promise<any[]> {
        const query = `SELECT * FROM padron_raw pr WHERE pr.dni = $1`;
        const result = await pool.query(query, [dni]);
        return result.rows;
    }

    async search(params: PadronSearchParams): Promise<any[]> {
        const { nombres, paterno, materno, dni } = params;

        let query = 'SELECT * FROM padron_raw pr WHERE 1=1';
        const values: any[] = [];
        let paramCount = 1;

        if (dni) {
            query += ` AND pr.dni LIKE $${paramCount}`;
            values.push(`%${dni}%`);
            paramCount++;
        }

        if (nombres) {
            query += ` AND pr.nombres ILIKE $${paramCount}`;
            values.push(`%${nombres}%`);
            paramCount++;
        }

        if (paterno) {
            query += ` AND pr.paterno ILIKE $${paramCount}`;
            values.push(`%${paterno}%`);
            paramCount++;
        }

        if (materno) {
            query += ` AND pr.materno ILIKE $${paramCount}`;
            values.push(`%${materno}%`);
            paramCount++;
        }

        const result = await pool.query(query, values);
        return result.rows;
    }
}
