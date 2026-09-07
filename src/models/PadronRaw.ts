import { DataTypes, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/sequelize';

// Tabla cruda del padron (pre-normalizacion). La usan padronService, utpService y fotoService.
// 'foto' se agrego para cachear la foto de RENIEC (fotoService).
export class PadronRaw extends Model<
    InferAttributes<PadronRaw>,
    InferCreationAttributes<PadronRaw>
> {
    declare dni: string;                 // varchar(20) PK
    declare paterno: string | null;
    declare materno: string | null;
    declare nombres: string | null;
    declare fecha_nac: string | null;    // DATEONLY 'YYYY-MM-DD'
    declare fecha_1: string | null;
    declare fecha_2: string | null;
    declare fecha_3: string | null;
    declare ubigeo: string | null;
    declare ubigeo_desc: string | null;
    declare direccion: string | null;
    declare cod_1: string | null;
    declare estado_civil: string | null;
    declare cod_2: string | null;
    declare madre: string | null;
    declare padre: string | null;
    declare foto: string | null;
}

PadronRaw.init(
    {
        dni: { type: DataTypes.STRING(20), primaryKey: true },
        paterno: { type: DataTypes.TEXT, allowNull: true },
        materno: { type: DataTypes.TEXT, allowNull: true },
        nombres: { type: DataTypes.TEXT, allowNull: true },
        fecha_nac: { type: DataTypes.DATEONLY, allowNull: true },
        fecha_1: { type: DataTypes.TEXT, allowNull: true },
        fecha_2: { type: DataTypes.TEXT, allowNull: true },
        fecha_3: { type: DataTypes.TEXT, allowNull: true },
        ubigeo: { type: DataTypes.TEXT, allowNull: true },
        ubigeo_desc: { type: DataTypes.TEXT, allowNull: true },
        direccion: { type: DataTypes.TEXT, allowNull: true },
        cod_1: { type: DataTypes.TEXT, allowNull: true },
        estado_civil: { type: DataTypes.TEXT, allowNull: true },
        cod_2: { type: DataTypes.TEXT, allowNull: true },
        madre: { type: DataTypes.TEXT, allowNull: true },
        padre: { type: DataTypes.TEXT, allowNull: true },
        foto: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'padron_raw' }
);
