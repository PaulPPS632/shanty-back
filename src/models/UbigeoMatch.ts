import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { UbigeoDistrito } from './UbigeoDistrito';

// Mapea cada ubigeo_desc distinto del padron a su distrito_id (origen: exacto/alias/extranjero/sin_resolver).
@Table({ tableName: 'ubigeo_match', timestamps: false, freezeTableName: true })
export class UbigeoMatch extends Model<
    InferAttributes<UbigeoMatch>,
    InferCreationAttributes<UbigeoMatch>
> {
    @PrimaryKey
    @Column({ type: DataType.TEXT, allowNull: false })
    ubigeo_desc!: string;

    @ForeignKey(() => UbigeoDistrito)
    @Column({ type: DataType.CHAR(6), allowNull: true })
    distrito_id!: string | null; // char(6), NULL en extranjero/sin_resolver

    @Column({ type: DataType.TEXT, allowNull: false })
    origen!: string;

    @BelongsTo(() => UbigeoDistrito, { as: 'distrito', foreignKey: 'distrito_id', targetKey: 'id' })
    distrito?: NonAttribute<UbigeoDistrito>;
}
