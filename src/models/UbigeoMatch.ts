import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Mapea cada ubigeo_desc distinto del padron a su distrito_id (origen: exacto/alias/extranjero/sin_resolver).
export class UbigeoMatch extends Model<
    InferAttributes<UbigeoMatch>,
    InferCreationAttributes<UbigeoMatch>
> {
    declare ubigeo_desc: string;
    declare distrito_id: string | null; // char(6), NULL en extranjero/sin_resolver
    declare origen: string;
}

UbigeoMatch.init(
    {
        ubigeo_desc: { type: DataTypes.TEXT, primaryKey: true },
        distrito_id: { type: DataTypes.CHAR(6), allowNull: true },
        origen: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, tableName: 'ubigeo_match' }
);
