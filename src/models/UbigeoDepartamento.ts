import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, HasMany } from 'sequelize-typescript';
import { UbigeoProvincia } from './UbigeoProvincia';

@Table({ tableName: 'ubigeo_departamento', timestamps: false, freezeTableName: true })
export class UbigeoDepartamento extends Model<
    InferAttributes<UbigeoDepartamento>,
    InferCreationAttributes<UbigeoDepartamento>
> {
    @PrimaryKey
    @Column({ type: DataType.CHAR(2), allowNull: false })
    id!: string;        // char(2)  ej '15'

    @Column({ type: DataType.TEXT, allowNull: false })
    nombre!: string;

    @HasMany(() => UbigeoProvincia, { as: 'provincias', foreignKey: 'departamento_id', sourceKey: 'id' })
    provincias?: NonAttribute<UbigeoProvincia[]>;
}
