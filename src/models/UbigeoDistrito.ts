import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { UbigeoDepartamento } from './UbigeoDepartamento';
import { UbigeoProvincia } from './UbigeoProvincia';

@Table({ tableName: 'ubigeo_distrito', timestamps: false, freezeTableName: true })
export class UbigeoDistrito extends Model<
    InferAttributes<UbigeoDistrito>,
    InferCreationAttributes<UbigeoDistrito>
> {
    @PrimaryKey
    @Column({ type: DataType.CHAR(6), allowNull: false })
    id!: string;              // char(6)  ej '150105'

    @Column({ type: DataType.TEXT, allowNull: false })
    nombre!: string;

    @ForeignKey(() => UbigeoProvincia)
    @Column({ type: DataType.CHAR(4), allowNull: false })
    provincia_id!: string;    // char(4) FK

    @ForeignKey(() => UbigeoDepartamento)
    @Column({ type: DataType.CHAR(2), allowNull: false })
    departamento_id!: string; // char(2) FK

    @BelongsTo(() => UbigeoProvincia, { as: 'provincia', foreignKey: 'provincia_id', targetKey: 'id' })
    provincia?: NonAttribute<UbigeoProvincia>;

    @BelongsTo(() => UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' })
    departamento?: NonAttribute<UbigeoDepartamento>;
}
