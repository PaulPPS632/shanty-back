import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

export class UbigeoDistrito extends Model<
    InferAttributes<UbigeoDistrito>,
    InferCreationAttributes<UbigeoDistrito>
> {
    declare id: string;              // char(6)  ej '150105'
    declare nombre: string;
    declare provincia_id: string;    // char(4) FK
    declare departamento_id: string; // char(2) FK
}

UbigeoDistrito.init(
    {
        id: { type: DataTypes.CHAR(6), primaryKey: true },
        nombre: { type: DataTypes.TEXT, allowNull: false },
        provincia_id: { type: DataTypes.CHAR(4), allowNull: false },
        departamento_id: { type: DataTypes.CHAR(2), allowNull: false },
    },
    { sequelize, tableName: 'ubigeo_distrito' }
);
