import { InferAttributes, InferCreationAttributes } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

// Telefonos asociados a RUC (osiptel, tipo_documento='RUC'). Sin FK (no hay tabla de RUC).
// Misma estructura que Telefono. dni->ruc. PK solo a nivel Sequelize (ver nota en Telefono).
@Table({ tableName: 'telefonos_ruc', timestamps: false, freezeTableName: true })
export class TelefonoRuc extends Model<
    InferAttributes<TelefonoRuc>,
    InferCreationAttributes<TelefonoRuc>
> {
    @PrimaryKey
    @Column({ type: DataType.STRING(20), allowNull: false })
    ruc!: string;                 // varchar(20)

    @Column({ type: DataType.TEXT, allowNull: true })
    empresa!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    periodo!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    operador!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    plan!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    telefono!: string | null;
}
