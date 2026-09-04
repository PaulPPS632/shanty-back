import axios from 'axios';
import { pool } from '../config/db';

interface ReniecResponse {
    apPrimer: string;
    apSegundo: string;
    direccion: string;
    estadoCivil: string;
    foto: string;
    prenombres: string;
    restriccion: string;
    ubigeo: string;
}

export class FotoService {
    private async fetchFromReniec(dni: string): Promise<Partial<ReniecResponse>> {
        const params = new URLSearchParams();
        params.append('action', 'dni');
        params.append('valor1', dni);

        const response = await axios.post(
            'https://sis.itp.gob.pe/FormITP_SSIPRO/ApiPideReniecServlet',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return response.data as Partial<ReniecResponse>;
    }

    private async savePhoto(dni: string, foto: string): Promise<void> {
        const updateQuery = 'UPDATE padron_raw SET foto = $1 WHERE dni = $2';
        await pool.query(updateQuery, [foto, dni]);
    }

    // Always fetches fresh from the external API and overwrites the stored photo.
    async fetchAndStorePhoto(dni: string): Promise<string | null> {
        const externalData = await this.fetchFromReniec(dni);

        if (!externalData || !externalData.foto) {
            return null;
        }

        await this.savePhoto(dni, externalData.foto);
        return externalData.foto;
    }

    // Returns the cached photo from padron_raw when present; otherwise fetches and caches it.
    // Returns undefined when the DNI isn't in padron at all (caller should 404).
    async getCachedOrFetchPhoto(dni: string): Promise<string | null | undefined> {
        const userQuery = 'SELECT foto FROM padron_raw WHERE dni = $1';
        const userResult = await pool.query(userQuery, [dni]);

        if (userResult.rows.length === 0) {
            return undefined;
        }

        const user = userResult.rows[0];

        if (user.foto && user.foto.trim() !== '') {
            return user.foto;
        }

        return this.fetchAndStorePhoto(dni);
    }
}
