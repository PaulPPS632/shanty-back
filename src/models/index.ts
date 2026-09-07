import { sequelize } from '../config/sequelize';
import { UbigeoDepartamento } from './UbigeoDepartamento';
import { UbigeoProvincia } from './UbigeoProvincia';
import { UbigeoDistrito } from './UbigeoDistrito';
import { UbigeoMatch } from './UbigeoMatch';
import { Persona } from './Persona';
import { Telefono } from './Telefono';
import { TelefonoRuc } from './TelefonoRuc';
import { Empresa } from './Empresa';

// Registro de modelos en la instancia. Las asociaciones ya viven en cada clase
// (@BelongsTo / @HasMany), asi que aca solo se declara el conjunto.
// Importar SIEMPRE desde este archivo: es lo que garantiza el addModels.
sequelize.addModels([
    UbigeoDepartamento,
    UbigeoProvincia,
    UbigeoDistrito,
    UbigeoMatch,
    Persona,
    Telefono,
    TelefonoRuc,
    Empresa,
]);

export {
    sequelize,
    UbigeoDepartamento,
    UbigeoProvincia,
    UbigeoDistrito,
    UbigeoMatch,
    Persona,
    Telefono,
    TelefonoRuc,
    Empresa,
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
    Empresa,
};
