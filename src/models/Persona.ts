import { InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { UbigeoDepartamento } from './UbigeoDepartamento';
import { UbigeoProvincia } from './UbigeoProvincia';
import { UbigeoDistrito } from './UbigeoDistrito';
import { Telefono } from './Telefono';

// Tabla normalizada del padron (ver NORMALIZACION.md). PK: dni.
// Usar paterno_norm / materno_norm (sin Ñ ni acentos) para BUSCAR; paterno / materno para MOSTRAR.
@Table({ tableName: 'personas', timestamps: false, freezeTableName: true })
export class Persona extends Model<
    InferAttributes<Persona>,
    InferCreationAttributes<Persona>
> {
    @PrimaryKey
    @Column({ type: DataType.STRING(20), allowNull: false })
    dni!: string;                      // varchar(20) PK (8 digitos, con ceros a la izq)

    @Column({ type: DataType.TEXT, allowNull: true })
    paterno!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    materno!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    nombres!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    paterno_norm!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    materno_norm!: string | null;

    @Column({ type: DataType.DATEONLY, allowNull: true })
    fecha_nac!: string | null;         // DATEONLY -> 'YYYY-MM-DD'

    @Column({ type: DataType.DATEONLY, allowNull: true })
    fecha_inscripcion!: string | null;

    @Column({ type: DataType.DATEONLY, allowNull: true })
    fecha_2!: string | null;

    @Column({ type: DataType.DATEONLY, allowNull: true })
    fecha_3!: string | null;

    @ForeignKey(() => UbigeoDistrito)
    @Column({ type: DataType.CHAR(6), allowNull: true })
    distrito_id!: string | null;       // char(6) FK

    @ForeignKey(() => UbigeoProvincia)
    @Column({ type: DataType.CHAR(4), allowNull: true })
    provincia_id!: string | null;      // char(4) FK

    @ForeignKey(() => UbigeoDepartamento)
    @Column({ type: DataType.CHAR(2), allowNull: true })
    departamento_id!: string | null;   // char(2) FK

    @Column({ type: DataType.TEXT, allowNull: true })
    ubigeo_desc!: string | null;

    @Column({ type: DataType.STRING(20), allowNull: true })
    ubigeo_origen!: string | null;     // ubigeo crudo del origen, no usar para vincular

    @Column({ type: DataType.TEXT, allowNull: true })
    direccion!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    madre!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    padre!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    estado_civil!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    cod_1!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    cod_2!: string | null;

    // Foto de RENIEC en base64 (JPEG). Cacheada por fotoService.
    @Column({ type: DataType.TEXT, allowNull: true })
    foto!: string | null;

    // ---------- asociaciones (solo para mostrar; filtrar por *_id directo) ----------
    @BelongsTo(() => UbigeoDistrito, { as: 'distrito', foreignKey: 'distrito_id', targetKey: 'id' })
    distrito?: NonAttribute<UbigeoDistrito>;

    @BelongsTo(() => UbigeoProvincia, { as: 'provincia', foreignKey: 'provincia_id', targetKey: 'id' })
    provincia?: NonAttribute<UbigeoProvincia>;

    @BelongsTo(() => UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' })
    departamento?: NonAttribute<UbigeoDepartamento>;

    @HasMany(() => Telefono, { as: 'telefonos', foreignKey: 'dni', sourceKey: 'dni' })
    telefonos?: NonAttribute<Telefono[]>;
}
