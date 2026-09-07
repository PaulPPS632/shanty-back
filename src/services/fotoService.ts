import axios from 'axios';
import { Persona } from '../models';

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
        await Persona.update({ foto }, { where: { dni } });
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

    // Returns the cached photo from personas when present; otherwise fetches and caches it.
    // Returns undefined when the DNI isn't in personas at all (caller should 404).
    async getCachedOrFetchPhoto(dni: string): Promise<string | null | undefined> {
        const row = await Persona.findByPk(dni, { attributes: ['foto'], raw: true });

        if (!row) {
            return undefined;
        }

        if (row.foto && row.foto.trim() !== '') {
            return row.foto;
        }

        return this.fetchAndStorePhoto(dni);
    }
}
