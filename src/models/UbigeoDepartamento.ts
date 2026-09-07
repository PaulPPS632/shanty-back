import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export class UbigeoDepartamento extends Model<
    InferAttributes<UbigeoDepartamento>,
    InferCreationAttributes<UbigeoDepartamento>
> {
    declare id: string;        // char(2)  ej '15'
    declare nombre: string;
}

UbigeoDepartamento.init(
    {
        id: { type: DataTypes.CHAR(2), primaryKey: true },
        nombre: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, tableName: 'ubigeo_departamento' }
);
