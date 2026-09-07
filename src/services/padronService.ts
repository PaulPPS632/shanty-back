import { Op } from 'sequelize';
import { PadronRaw } from '../models';

export interface PadronSearchParams {
    nombres?: string;
    paterno?: string;
    materno?: string;
    dni?: string;
}

export class PadronService {
    async findSpecificName(): Promise<any[]> {
        return PadronRaw.findAll({
            where: { nombres: 'ABRAHAM STEVE', paterno: 'CANEZ', materno: 'GIL' },
            raw: true,
        });
    }

    async findByDni(dni: string): Promise<any[]> {
        return PadronRaw.findAll({ where: { dni }, raw: true });
    }

    async search(params: PadronSearchParams): Promise<any[]> {
        const { nombres, paterno, materno, dni } = params;

        const where: Record<string, any> = {};
        if (dni)     where.dni     = { [Op.like]:  `%${dni}%` };      // dni: LIKE (igual que antes)
        if (nombres) where.nombres = { [Op.iLike]: `%${nombres}%` };  // nombres/paterno/materno: ILIKE
        if (paterno) where.paterno = { [Op.iLike]: `%${paterno}%` };
        if (materno) where.materno = { [Op.iLike]: `%${materno}%` };

        return PadronRaw.findAll({ where, raw: true });
    }
}
