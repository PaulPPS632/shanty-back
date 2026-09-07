import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { UbigeoDepartamento } from './UbigeoDepartamento';
import { UbigeoDistrito } from './UbigeoDistrito';

@Table({ tableName: 'ubigeo_provincia', timestamps: false, freezeTableName: true })
export class UbigeoProvincia extends Model<
    InferAttributes<UbigeoProvincia>,
    InferCreationAttributes<UbigeoProvincia>
> {
    @PrimaryKey
    @Column({ type: DataType.CHAR(4), allowNull: false })
    id!: string;              // char(4)  ej '1501'

    @Column({ type: DataType.TEXT, allowNull: false })
    nombre!: string;

    @ForeignKey(() => UbigeoDepartamento)
    @Column({ type: DataType.CHAR(2), allowNull: false })
    departamento_id!: string; // char(2) FK

    @BelongsTo(() => UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' })
    departamento?: NonAttribute<UbigeoDepartamento>;

    @HasMany(() => UbigeoDistrito, { as: 'distritos', foreignKey: 'provincia_id', sourceKey: 'id' })
    distritos?: NonAttribute<UbigeoDistrito[]>;
}
