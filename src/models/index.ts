import { sequelize } from '../config/sequelize';
import { UbigeoDepartamento } from './UbigeoDepartamento';
import { UbigeoProvincia } from './UbigeoProvincia';
import { UbigeoDistrito } from './UbigeoDistrito';
import { UbigeoMatch } from './UbigeoMatch';
import { Persona } from './Persona';
import { Telefono } from './Telefono';
import { TelefonoRuc } from './TelefonoRuc';
import { PadronRaw } from './PadronRaw';

// ---------- Jerarquia ubigeo ----------
UbigeoDepartamento.hasMany(UbigeoProvincia, { as: 'provincias', foreignKey: 'departamento_id', sourceKey: 'id' });
UbigeoProvincia.belongsTo(UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' });

UbigeoProvincia.hasMany(UbigeoDistrito, { as: 'distritos', foreignKey: 'provincia_id', sourceKey: 'id' });
UbigeoDistrito.belongsTo(UbigeoProvincia, { as: 'provincia', foreignKey: 'provincia_id', targetKey: 'id' });
UbigeoDistrito.belongsTo(UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' });

UbigeoMatch.belongsTo(UbigeoDistrito, { as: 'distrito', foreignKey: 'distrito_id', targetKey: 'id' });

// ---------- Persona <-> ubigeo (solo para mostrar; filtrar por *_id directo) ----------
Persona.belongsTo(UbigeoDistrito, { as: 'distrito', foreignKey: 'distrito_id', targetKey: 'id' });
Persona.belongsTo(UbigeoProvincia, { as: 'provincia', foreignKey: 'provincia_id', targetKey: 'id' });
Persona.belongsTo(UbigeoDepartamento, { as: 'departamento', foreignKey: 'departamento_id', targetKey: 'id' });

// ---------- Persona <-> telefonos ----------
Persona.hasMany(Telefono, { as: 'telefonos', foreignKey: 'dni', sourceKey: 'dni' });
Telefono.belongsTo(Persona, { as: 'persona', foreignKey: 'dni', targetKey: 'dni' });

// telefonos_ruc no tiene asociacion (no hay tabla de RUC).

export {
    sequelize,
    UbigeoDepartamento,
    UbigeoProvincia,
    UbigeoDistrito,
    UbigeoMatch,
    Persona,
    Telefono,
    TelefonoRuc,
    PadronRaw,
};

export default {
    sequelize,
    UbigeoDepartamento,
    UbigeoProvincia,
    UbigeoDistrito,
    UbigeoMatch,
    Persona,
    Telefono,
    TelefonoRuc,
    PadronRaw,
};
