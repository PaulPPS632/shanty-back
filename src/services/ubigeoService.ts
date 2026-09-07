import { UbigeoDepartamento, UbigeoDistrito, UbigeoProvincia } from '../models';

// Catalogos para los selects en cascada del buscador. Son tablas chicas
// (25 / 196 / 1874 filas), asi que se devuelven completas sin paginar.
export class UbigeoService {
    async departamentos(): Promise<any[]> {
        return UbigeoDepartamento.findAll({
            attributes: ['id', 'nombre'],
            order: [['nombre', 'ASC']],
            raw: true,
        });
    }

    async provincias(departamentoId?: string): Promise<any[]> {
        return UbigeoProvincia.findAll({
            attributes: ['id', 'nombre', 'departamento_id'],
            where: departamentoId ? { departamento_id: departamentoId } : undefined,
            order: [['nombre', 'ASC']],
            raw: true,
        });
    }

    async distritos(provinciaId?: string, departamentoId?: string): Promise<any[]> {
        const where: Record<string, unknown> = {};

        if (provinciaId) where.provincia_id = provinciaId;
        else if (departamentoId) where.departamento_id = departamentoId;

        return UbigeoDistrito.findAll({
            attributes: ['id', 'nombre', 'provincia_id', 'departamento_id'],
            where: Object.keys(where).length ? where : undefined,
            order: [['nombre', 'ASC']],
            raw: true,
        });
    }
}
