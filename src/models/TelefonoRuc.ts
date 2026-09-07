import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Telefonos asociados a RUC (osiptel, tipo_documento='RUC'). Sin FK (no hay tabla de RUC).
// Misma estructura que Telefono. dni->ruc. PK solo a nivel Sequelize (ver nota en Telefono).
export class TelefonoRuc extends Model<
    InferAttributes<TelefonoRuc>,
    InferCreationAttributes<TelefonoRuc>
> {
    declare ruc: string;                 // varchar(20)
    declare empresa: string | null;
    declare periodo: string | null;
    declare operador: string | null;
    declare plan: string | null;
    declare telefono: string | null;
}

TelefonoRuc.init(
    {
        ruc: { type: DataTypes.STRING(20), primaryKey: true },
        empresa: { type: DataTypes.TEXT, allowNull: true },
        periodo: { type: DataTypes.TEXT, allowNull: true },
        operador: { type: DataTypes.TEXT, allowNull: true },
        plan: { type: DataTypes.TEXT, allowNull: true },
        telefono: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'telefonos_ruc' }
);
