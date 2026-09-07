import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Persona } from './Persona';

// Telefonos de personas naturales (osiptel, tipo_documento='DNI'). dni -> FK personas.dni.
// NOTA: la tabla no tiene PK real (un dni tiene muchas filas). Se marca dni como @PrimaryKey
// solo a nivel Sequelize para evitar la columna 'id' fantasma. Para mutar filas puntuales
// usar queries crudas; el modelo sirve para lectura/joins.
@Table({ tableName: 'telefonos', timestamps: false, freezeTableName: true })
export class Telefono extends Model<
    InferAttributes<Telefono>,
    InferCreationAttributes<Telefono>
> {
    @PrimaryKey
    @ForeignKey(() => Persona)
    @Column({ type: DataType.STRING(20), allowNull: false })
    dni!: string;                 // varchar(20) FK -> personas.dni

    @Column({ type: DataType.TEXT, allowNull: true })
    empresa!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    periodo!: string | null;      // 'YYYY/MM'

    @Column({ type: DataType.TEXT, allowNull: true })
    operador!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    plan!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    telefono!: string | null;

    @BelongsTo(() => Persona, { as: 'persona', foreignKey: 'dni', targetKey: 'dni' })
    persona?: NonAttribute<Persona>;
}
