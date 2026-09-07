import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Tabla normalizada del padron (ver NORMALIZACION.md). PK: dni.
// Usar paterno_norm / materno_norm (sin Ñ ni acentos) para BUSCAR; paterno / materno para MOSTRAR.
export class Persona extends Model<
    InferAttributes<Persona>,
    InferCreationAttributes<Persona>
> {
    declare dni: string;                      // varchar(20) PK (8 digitos, con ceros a la izq)
    declare paterno: string | null;
    declare materno: string | null;
    declare nombres: string | null;
    declare paterno_norm: string | null;
    declare materno_norm: string | null;
    declare fecha_nac: string | null;         // DATEONLY -> 'YYYY-MM-DD'
    declare fecha_inscripcion: string | null;
    declare fecha_2: string | null;
    declare fecha_3: string | null;
    declare distrito_id: string | null;       // char(6) FK
    declare provincia_id: string | null;      // char(4) FK
    declare departamento_id: string | null;   // char(2) FK
    declare ubigeo_desc: string | null;
    declare ubigeo_origen: string | null;     // columna corrupta del origen, no usar para vincular
    declare direccion: string | null;
    declare madre: string | null;
    declare padre: string | null;
    declare estado_civil: string | null;
    declare cod_1: string | null;
    declare cod_2: string | null;
}

Persona.init(
    {
        dni: { type: DataTypes.STRING(20), primaryKey: true },
        paterno: { type: DataTypes.TEXT, allowNull: true },
        materno: { type: DataTypes.TEXT, allowNull: true },
        nombres: { type: DataTypes.TEXT, allowNull: true },
        paterno_norm: { type: DataTypes.TEXT, allowNull: true },
        materno_norm: { type: DataTypes.TEXT, allowNull: true },
        fecha_nac: { type: DataTypes.DATEONLY, allowNull: true },
        fecha_inscripcion: { type: DataTypes.DATEONLY, allowNull: true },
        fecha_2: { type: DataTypes.DATEONLY, allowNull: true },
        fecha_3: { type: DataTypes.DATEONLY, allowNull: true },
        distrito_id: { type: DataTypes.CHAR(6), allowNull: true },
        provincia_id: { type: DataTypes.CHAR(4), allowNull: true },
        departamento_id: { type: DataTypes.CHAR(2), allowNull: true },
        ubigeo_desc: { type: DataTypes.TEXT, allowNull: true },
        ubigeo_origen: { type: DataTypes.STRING(20), allowNull: true },
        direccion: { type: DataTypes.TEXT, allowNull: true },
        madre: { type: DataTypes.TEXT, allowNull: true },
        padre: { type: DataTypes.TEXT, allowNull: true },
        estado_civil: { type: DataTypes.TEXT, allowNull: true },
        cod_1: { type: DataTypes.TEXT, allowNull: true },
        cod_2: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'personas' }
);
