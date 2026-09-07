import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Telefonos de personas naturales (osiptel, tipo_documento='DNI'). dni -> FK personas.dni.
// NOTA: la tabla no tiene PK real (un dni tiene muchas filas). Se marca dni como primaryKey
// solo a nivel Sequelize para evitar la columna 'id' fantasma. Para mutar filas puntuales
// usar queries crudas; el modelo sirve para lectura/joins.
export class Telefono extends Model<
    InferAttributes<Telefono>,
    InferCreationAttributes<Telefono>
> {
    declare dni: string;                 // varchar(20) FK -> personas.dni
    declare empresa: string | null;
    declare periodo: string | null;      // 'YYYY/MM'
    declare operador: string | null;
    declare plan: string | null;
    declare telefono: string | null;
}

Telefono.init(
    {
        dni: { type: DataTypes.STRING(20), primaryKey: true },
        empresa: { type: DataTypes.TEXT, allowNull: true },
        periodo: { type: DataTypes.TEXT, allowNull: true },
        operador: { type: DataTypes.TEXT, allowNull: true },
        plan: { type: DataTypes.TEXT, allowNull: true },
        telefono: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'telefonos' }
);
