import { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

import type { ActividadEconomica, ComprobanteElectronico } from '../services/rucService';

// Cache persistente de fichas RUC de SUNAT. Se puebla sola: cada consulta que
// no estaba guardada se inserta aca, y las siguientes ya no salen a SUNAT
// (que throttlea por IP y banea ~5 min al pasarse de tasa).
@Table({ tableName: 'empresas', timestamps: false, freezeTableName: true })
export class Empresa extends Model<
    InferAttributes<Empresa>,
    InferCreationAttributes<Empresa>
> {
    @PrimaryKey
    @Column({ type: DataType.STRING(11), allowNull: false })
    ruc!: string;

    @Column({ type: DataType.TEXT, allowNull: true })
    razon_social!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    tipo_contribuyente!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    nombre_comercial!: string | null;

    // SUNAT entrega 'dd/mm/aaaa'; se guarda como texto para no perder fidelidad.
    @Column({ type: DataType.TEXT, allowNull: true })
    fecha_inscripcion!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    fecha_inicio_actividades!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    estado!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    condicion!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    domicilio_fiscal!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    sistema_emision_comprobante!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    actividad_comercio_exterior!: string | null;

    @Column({ type: DataType.TEXT, allowNull: true })
    sistema_contabilidad!: string | null;

    @Column({ type: DataType.JSONB, allowNull: false })
    actividades_economicas!: CreationOptional<ActividadEconomica[]>;

    @Column({ type: DataType.JSONB, allowNull: false })
    comprobantes_pago!: CreationOptional<string[]>;

    @Column({ type: DataType.JSONB, allowNull: false })
    sistema_emision_electronica!: CreationOptional<string[]>;

    @Column({ type: DataType.TEXT, allowNull: true })
    emisor_electronico_desde!: string | null;

    @Column({ type: DataType.JSONB, allowNull: false })
    comprobantes_electronicos!: CreationOptional<ComprobanteElectronico[]>;

    @Column({ type: DataType.TEXT, allowNull: true })
    afiliado_ple_desde!: string | null;

    @Column({ type: DataType.JSONB, allowNull: false })
    padrones!: CreationOptional<string[]>;

    /** Cuando se trajo por primera vez desde SUNAT. */
    @Column({ type: DataType.DATE, allowNull: false })
    consultado_en!: CreationOptional<Date>;

    /** Ultima vez que se refresco contra SUNAT (?refrescar=1). */
    @Column({ type: DataType.DATE, allowNull: false })
    actualizado_en!: CreationOptional<Date>;
}
