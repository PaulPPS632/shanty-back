import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export class UbigeoProvincia extends Model<
    InferAttributes<UbigeoProvincia>,
    InferCreationAttributes<UbigeoProvincia>
> {
    declare id: string;              // char(4)  ej '1501'
    declare nombre: string;
    declare departamento_id: string; // char(2) FK
}

UbigeoProvincia.init(
    {
        id: { type: DataTypes.CHAR(4), primaryKey: true },
        nombre: { type: DataTypes.TEXT, allowNull: false },
        departamento_id: { type: DataTypes.CHAR(2), allowNull: false },
    },
    { sequelize, tableName: 'ubigeo_provincia' }
);
