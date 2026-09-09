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

/**
 * Union discriminada, misma forma que ResultadoConsulta de rucService: el
 * llamante necesita saber si la foto salio de `personas.foto` (gratis) o de una
 * llamada a RENIEC (de pago). Antes se devolvia solo la cadena y el cobro no
 * podia distinguirlos, asi que toda foto pagaba precio completo.
 */
export type ResultadoFoto =
    | { ok: true; foto: string; origen: 'db' | 'reniec' }
    | { ok: false; motivo: 'sin_persona' | 'sin_foto' };

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
    // `origen` dice cual de las dos cosas paso: es lo que decide el cobro.
    async getCachedOrFetchPhoto(dni: string): Promise<ResultadoFoto> {
        const row = await Persona.findByPk(dni, { attributes: ['foto'], raw: true });

        if (!row) {
            return { ok: false, motivo: 'sin_persona' };
        }

        if (row.foto && row.foto.trim() !== '') {
            return { ok: true, foto: row.foto, origen: 'db' };
        }

        const foto = await this.fetchAndStorePhoto(dni);

        return foto ? { ok: true, foto, origen: 'reniec' } : { ok: false, motivo: 'sin_foto' };
    }
}
