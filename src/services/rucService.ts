/**
 * Consulta RUC - SUNAT (e-consultaruc.sunat.gob.pe)
 *
 * Portado de /home/paul/Projects/SHANTY/ruc/main.ts. Se quito el CLI (readline,
 * import.meta.url) porque este proyecto compila a CommonJS; el resto es igual.
 *
 * Un solo POST a /jcrS00Alias. No hace falta pasar por el formulario ni tener
 * cookies: el servidor responde igual a un POST en frio.
 *
 * El campo `token` es obligatorio pero el servidor NO valida su valor; solo
 * revienta si falta o va vacio. No hay reCAPTCHA real.
 *
 * Sin dependencias: fetch nativo (Node >=18).
 */

import { Empresa } from '../models';

const URL_POST = 'https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias';

// OJO: no poner aqui un User-Agent de Chrome. `fetch` (undici) fuerza
// `sec-fetch-mode: cors` y manda `accept-language: *`, cosa que Chrome nunca
// hace; el WAF detecta la incoherencia y responde "Request Rejected" (245 B).
// Con un UA honesto pasa sin problema: el servidor no exige navegador.
const UA = 'consulta-ruc/1.0 (Node.js)';
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

// El WAF (F5 BIG-IP ASM) corta por TCP RST al pasarse de tasa por IP y el
// bloqueo dura ~5 min. Como aca las peticiones llegan de varios usuarios a la
// vez, se serializan con una separacion minima en vez de dejarlas concurrir.
const MS_ENTRE_CONSULTAS = 1100;

// `fetch` no trae timeout por defecto. Cuando el WAF esta throttleando, SUNAT
// acepta la conexion y no responde nunca: sin este limite la peticion queda
// colgada y, como la cola es serial, bloquea a todas las que vengan detras.
const TIMEOUT_MS = 20000;

// Tope de peticiones esperando en la cola. Con 1.1 s de separacion, una cola
// larga significa que el cliente igual va a esperar mas de lo razonable.
const MAX_EN_COLA = 20;


// --------------------------------------------------------------------------- //
// Tipos
// --------------------------------------------------------------------------- //

/** Fecha en el formato que devuelve SUNAT: `dd/mm/aaaa`. */
export type FechaPeru = string;

/** `(string & {})` deja pasar valores nuevos sin perder el autocompletado. */
export type EstadoContribuyente =
    | 'ACTIVO'
    | 'BAJA DE OFICIO'
    | 'BAJA PROVISIONAL'
    | 'BAJA DEFINITIVA'
    | 'SUSPENSION TEMPORAL'
    | 'PENDIENTE DE INSCRIPCION'
    | (string & {});

export type CondicionContribuyente =
    | 'HABIDO'
    | 'NO HABIDO'
    | 'NO HALLADO'
    | 'POR VERIFICAR'
    | (string & {});

export type TipoActividad = 'Principal' | 'Secundaria';

/** Una fila de "Actividad(es) Economica(s)", ya descompuesta. */
export interface ActividadEconomica {
    tipo: TipoActividad;
    /** Numero que acompana a "Secundaria N"; `null` en la principal. */
    orden: number | null;
    /** Codigo CIIU (4 digitos). */
    ciiu: string;
    descripcion: string;
    /** Texto original, por si el desglose falla. */
    crudo: string;
}

/** Una entrada de "Comprobantes Electronicos": `FACTURA (desde 12/09/2020)`. */
export interface ComprobanteElectronico {
    tipo: string;
    desde: FechaPeru | null;
}

/** Ficha RUC ya tipada. Los campos ausentes en la pagina quedan en `null`/`[]`. */
export interface FichaRuc {
    ruc: string;
    razonSocial: string;
    tipoContribuyente: string | null;
    nombreComercial: string | null;
    fechaInscripcion: FechaPeru | null;
    fechaInicioActividades: FechaPeru | null;
    estado: EstadoContribuyente | null;
    condicion: CondicionContribuyente | null;
    domicilioFiscal: string | null;
    sistemaEmisionComprobante: string | null;
    actividadComercioExterior: string | null;
    sistemaContabilidad: string | null;
    actividadesEconomicas: ActividadEconomica[];
    comprobantesPago: string[];
    sistemaEmisionElectronica: string[];
    emisorElectronicoDesde: FechaPeru | null;
    comprobantesElectronicos: ComprobanteElectronico[];
    afiliadoPleDesde: FechaPeru | null;
    padrones: string[];
}

/** Mapa etiqueta -> valor; array cuando la celda traia una tabla. */
export type CamposCrudos = Record<string, string | string[]>;

/** Motivo del fallo, para que el controller elija el status HTTP. */
export type MotivoFallo = 'invalido' | 'conexion' | 'sin_resultados' | 'saturado';

/** De donde salio la ficha: la tabla `empresas` o una consulta a SUNAT. */
export type OrigenFicha = 'db' | 'sunat';

/** Union discriminada: obliga a chequear `ok` antes de tocar `ficha`. */
export type ResultadoConsulta =
    | { ok: true; ficha: FichaRuc; origen: OrigenFicha; consultadoEn: Date | null }
    | { ok: false; motivo: MotivoFallo; error: string };

// --------------------------------------------------------------------------- //
// Utilidades de texto
// --------------------------------------------------------------------------- //

const ENTIDADES: Record<string, string> = {
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
    ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    deg: '°', ordm: 'º', ordf: 'ª',
};

/** Resuelve entidades HTML (nombradas y numericas). */
function desescapar(texto: string): string {
    return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, ent: string) => {
        if (ent.startsWith('#')) {
            const hex = ent[1]?.toLowerCase() === 'x';
            const n = parseInt(hex ? ent.slice(2) : ent.slice(1), hex ? 16 : 10);

            return Number.isFinite(n) ? String.fromCodePoint(n) : todo;
        }

        return ENTIDADES[ent] ?? todo;
    });
}

/** Quita tags, resuelve entidades y colapsa espacios. */
function limpiar(fragmento: string): string {
    return desescapar(fragmento.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** `-` y `NINGUNO` son las formas en que SUNAT dice "vacio". */
function vacio(valor: string): boolean {
    return valor === '' || valor === '-' || valor.toUpperCase() === 'NINGUNO';
}

// --------------------------------------------------------------------------- //
// Consulta
// --------------------------------------------------------------------------- //

/** 52 chars base36, igual que generateKey(0x34) de sunatrecaptcha3.js. */
export function generarToken(): string {
    let salida = '';

    for (let i = 0; i < 52; i++) {
        salida += BASE36[Math.floor(Math.random() * BASE36.length)];
    }

    return salida;
}

/** POST directo (sin cookies) y devuelve el HTML de la respuesta. */
export async function consultar(ruc: string): Promise<string> {
    // campos minimos: sin `modo=1` el servidor devuelve otro layout
    const datos = new URLSearchParams({
        accion: 'consPorRuc',
        nroRuc: ruc,
        token: generarToken(),
        modo: '1',
    });

    const respuesta = await fetch(URL_POST, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-PE,es;q=0.9',
        },
        body: datos,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // la pagina va en ISO-8859-1, no en UTF-8
    const crudo = await respuesta.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(crudo);

    if (html.includes('Request Rejected')) {
        throw new Error('el WAF rechazo la peticion (revisar headers o esperar)');
    }

    return html;
}

// --------------------------------------------------------------------------- //
// Parseo
// --------------------------------------------------------------------------- //

/** Ficha -> {etiqueta: valor}. Valor es string, o array si hay varias filas. */
export function parsearCampos(html: string): CamposCrudos {
    const bloque = /class="list-group">(.*?)<!-- fin list-group/s.exec(html);
    const zona = (bloque?.[1] ?? html).replace(/<!--.*?-->/gs, '');

    const acumulado: Record<string, string[]> = {};
    let etiqueta: string | null = null;

    // la ficha alterna: h4 con la etiqueta -> p/h4/td con el valor
    for (const [, , contenido] of zona.matchAll(/<(h4|p|td)\b[^>]*>(.*?)<\/\1>/gs)) {
        const texto = limpiar(contenido ?? '');

        if (!texto) continue;

        if (texto.endsWith(':')) {
            etiqueta = texto.slice(0, -1);
            acumulado[etiqueta] = [];
        } else if (etiqueta) {
            acumulado[etiqueta]!.push(texto);
        }
    }

    return Object.fromEntries(
        Object.entries(acumulado).map(([k, v]) => [k, v.length === 1 ? v[0]! : v]),
    );
}

/** Mensaje de la pagina cuando no hay resultados (a veces viene vacio). */
export function errorDe(html: string): string {
    const m = /class="panel-body[^"]*"[^>]*>(.*?)<\/div>/s.exec(html);

    return (m && limpiar(m[1]!)) || 'RUC sin resultados o no valido';
}

function texto(campos: CamposCrudos, etiqueta: string): string | null {
    const valor = campos[etiqueta];

    if (typeof valor !== 'string' || vacio(valor)) return null;

    return valor;
}

function lista(campos: CamposCrudos, etiqueta: string): string[] {
    const valor = campos[etiqueta];

    if (valor === undefined) return [];

    const filas = Array.isArray(valor) ? valor : [valor];

    return filas.filter((f) => !vacio(f));
}

/** `Principal - 4741 - VENTA...` / `Secundaria 1 - 9511 - REPARACION...` */
function parsearActividades(filas: string[]): ActividadEconomica[] {
    return filas.map((crudo) => {
        const m = /^(Principal|Secundaria)\s*(\d+)?\s*-\s*(\d+)\s*-\s*(.+)$/i.exec(crudo);

        if (!m) return { tipo: 'Principal' as TipoActividad, orden: null, ciiu: '', descripcion: crudo, crudo };

        const tipo = (m[1]![0]!.toUpperCase() + m[1]!.slice(1).toLowerCase()) as TipoActividad;

        return {
            tipo,
            orden: m[2] ? Number(m[2]) : null,
            ciiu: m[3]!,
            descripcion: m[4]!.trim(),
            crudo,
        };
    });
}

/** `FACTURA (desde 12/09/2020),BOLETA (desde 14/09/2020)` */
function parsearComprobantes(valor: string | null): ComprobanteElectronico[] {
    if (!valor) return [];

    return valor.split(',').map((parte) => {
        const m = /^(.+?)\s*\(\s*desde\s+(.+?)\s*\)$/i.exec(parte.trim());

        return m
            ? { tipo: m[1]!.trim(), desde: m[2]! }
            : { tipo: parte.trim(), desde: null };
    });
}

/** Campos crudos -> ficha tipada. `null` si la pagina no traia el RUC. */
export function aFicha(campos: CamposCrudos): FichaRuc | null {
    const cabecera = texto(campos, 'Número de RUC');

    if (!cabecera) return null;

    const corte = cabecera.indexOf(' - ');

    return {
        ruc: corte === -1 ? cabecera : cabecera.slice(0, corte).trim(),
        razonSocial: corte === -1 ? '' : cabecera.slice(corte + 3).trim(),
        tipoContribuyente: texto(campos, 'Tipo Contribuyente'),
        nombreComercial: texto(campos, 'Nombre Comercial'),
        fechaInscripcion: texto(campos, 'Fecha de Inscripción'),
        fechaInicioActividades: texto(campos, 'Fecha de Inicio de Actividades'),
        estado: texto(campos, 'Estado del Contribuyente'),
        condicion: texto(campos, 'Condición del Contribuyente'),
        domicilioFiscal: texto(campos, 'Domicilio Fiscal'),
        sistemaEmisionComprobante: texto(campos, 'Sistema Emisión de Comprobante'),
        actividadComercioExterior: texto(campos, 'Actividad Comercio Exterior'),
        sistemaContabilidad: texto(campos, 'Sistema Contabilidad'),
        actividadesEconomicas: parsearActividades(lista(campos, 'Actividad(es) Económica(s)')),
        comprobantesPago: lista(campos, 'Comprobantes de Pago c/aut. de impresión (F. 806 u 816)'),
        sistemaEmisionElectronica: lista(campos, 'Sistema de Emisión Electrónica'),
        emisorElectronicoDesde: texto(campos, 'Emisor electrónico desde'),
        comprobantesElectronicos: parsearComprobantes(texto(campos, 'Comprobantes Electrónicos')),
        afiliadoPleDesde: texto(campos, 'Afiliado al PLE desde'),
        padrones: lista(campos, 'Padrones'),
    };
}

// --------------------------------------------------------------------------- //
// Servicio
// --------------------------------------------------------------------------- //

// Cola serial compartida por todo el proceso: cada consulta espera a la
// anterior y respeta MS_ENTRE_CONSULTAS. Sin esto, dos requests simultaneos
// bastan para que el WAF banee la IP por ~5 min.
let cola: Promise<unknown> = Promise.resolve();
let ultimaConsulta = 0;
let enEspera = 0;

export class ColaLlenaError extends Error {
    constructor() {
        super('demasiadas consultas RUC en cola, reintente en unos segundos');
    }
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
    if (enEspera >= MAX_EN_COLA) {
        return Promise.reject(new ColaLlenaError());
    }

    enEspera++;

    const siguiente = cola.then(async () => {
        const espera = MS_ENTRE_CONSULTAS - (Date.now() - ultimaConsulta);

        if (espera > 0) await dormir(espera);

        try {
            return await tarea();
        } finally {
            ultimaConsulta = Date.now();
            enEspera--;
        }
    });

    // La cola no debe romperse si una tarea falla.
    cola = siguiente.catch(() => undefined);

    return siguiente;
}

export class RucService {
    /**
     * Ficha RUC. La tabla `empresas` es la fuente: si el RUC ya esta guardado
     * NO se consulta a SUNAT. Solo se sale a la red la primera vez, o con
     * `refrescar` en true.
     */
    async consultarRuc(ruc: string, refrescar = false): Promise<ResultadoConsulta> {
        const numero = (ruc || '').replace(/\D/g, '');

        if (!/^\d{11}$/.test(numero)) {
            return { ok: false, motivo: 'invalido', error: `RUC invalido: ${ruc} (deben ser 11 digitos)` };
        }

        if (!refrescar) {
            const guardada = await Empresa.findByPk(numero, { raw: true });

            if (guardada) {
                return { ok: true, ficha: aFichaDesdeFila(guardada), origen: 'db', consultadoEn: guardada.consultado_en };
            }
        }

        let html: string;

        try {
            html = await enCola(() => consultar(numero));
        } catch (e) {
            if (e instanceof ColaLlenaError) {
                return { ok: false, motivo: 'saturado', error: e.message };
            }

            const causa = e instanceof Error ? e.message : String(e);
            const porTimeout = e instanceof Error && e.name === 'TimeoutError';

            return {
                ok: false,
                motivo: 'conexion',
                error: porTimeout
                    ? `SUNAT no respondio en ${TIMEOUT_MS / 1000}s. El WAF suele throttlear por IP: esperar ~5 min.`
                    : `Fallo la conexion con SUNAT: ${causa}. Si se repite, el WAF bloqueo la IP: esperar ~5 min.`,
            };
        }

        const ficha = aFicha(parsearCampos(html));

        if (!ficha) {
            return { ok: false, motivo: 'sin_resultados', error: errorDe(html) };
        }

        const consultadoEn = await guardar(ficha);

        return { ok: true, ficha, origen: 'sunat', consultadoEn };
    }
}

// --------------------------------------------------------------------------- //
// Persistencia
// --------------------------------------------------------------------------- //

/** Fila de `empresas` -> ficha, para devolver siempre la misma forma. */
export function aFichaDesdeFila(fila: any): FichaRuc {
    return {
        ruc: fila.ruc,
        razonSocial: fila.razon_social ?? '',
        tipoContribuyente: fila.tipo_contribuyente,
        nombreComercial: fila.nombre_comercial,
        fechaInscripcion: fila.fecha_inscripcion,
        fechaInicioActividades: fila.fecha_inicio_actividades,
        estado: fila.estado,
        condicion: fila.condicion,
        domicilioFiscal: fila.domicilio_fiscal,
        sistemaEmisionComprobante: fila.sistema_emision_comprobante,
        actividadComercioExterior: fila.actividad_comercio_exterior,
        sistemaContabilidad: fila.sistema_contabilidad,
        actividadesEconomicas: fila.actividades_economicas ?? [],
        comprobantesPago: fila.comprobantes_pago ?? [],
        sistemaEmisionElectronica: fila.sistema_emision_electronica ?? [],
        emisorElectronicoDesde: fila.emisor_electronico_desde,
        comprobantesElectronicos: fila.comprobantes_electronicos ?? [],
        afiliadoPleDesde: fila.afiliado_ple_desde,
        padrones: fila.padrones ?? [],
    };
}

/**
 * Inserta o actualiza la ficha. `consultado_en` se conserva en el upsert
 * (es "cuando la vimos por primera vez"); `actualizado_en` sí se pisa.
 */
async function guardar(ficha: FichaRuc): Promise<Date | null> {
    const ahora = new Date();

    const fila = {
        ruc: ficha.ruc,
        razon_social: ficha.razonSocial,
        tipo_contribuyente: ficha.tipoContribuyente,
        nombre_comercial: ficha.nombreComercial,
        fecha_inscripcion: ficha.fechaInscripcion,
        fecha_inicio_actividades: ficha.fechaInicioActividades,
        estado: ficha.estado,
        condicion: ficha.condicion,
        domicilio_fiscal: ficha.domicilioFiscal,
        sistema_emision_comprobante: ficha.sistemaEmisionComprobante,
        actividad_comercio_exterior: ficha.actividadComercioExterior,
        sistema_contabilidad: ficha.sistemaContabilidad,
        actividades_economicas: ficha.actividadesEconomicas,
        comprobantes_pago: ficha.comprobantesPago,
        sistema_emision_electronica: ficha.sistemaEmisionElectronica,
        emisor_electronico_desde: ficha.emisorElectronicoDesde,
        comprobantes_electronicos: ficha.comprobantesElectronicos,
        afiliado_ple_desde: ficha.afiliadoPleDesde,
        padrones: ficha.padrones,
        actualizado_en: ahora,
    };

    try {
        const existente = await Empresa.findByPk(ficha.ruc, { raw: true });

        if (existente) {
            await Empresa.update(fila as any, { where: { ruc: ficha.ruc } });

            return existente.consultado_en;
        }

        await Empresa.create({ ...fila, consultado_en: ahora } as any);

        return ahora;
    } catch (e) {
        // Guardar es un efecto secundario: si falla, igual se devuelve la ficha.
        console.error('No se pudo guardar la empresa', ficha.ruc, e);

        return null;
    }
}
