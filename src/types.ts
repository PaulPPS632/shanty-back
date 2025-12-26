export interface Root {
  acumulado: number
  acumuladoUsado: number
  disponibilidad: string
  fechaInicioStr: string
  fechaFinStr: string
  cupones: any[]
  cuponesUsados: any[]
  id: number
  codigo: number
  nombre: string
  fechA_INICIO: string
  fechA_FIN: string
  condicioN_GENERAL: string
  urL_IMAGEN: string
  flag: number
  mensaje: string
  campaniaTags: any[]
  promovars: Promovar[]
}

export interface Promovar {
  acumulado: number
  acumuladoUsado: number
  id: number
  codigo: number
  campaniA_ID: number
  urL_IMAGEN: string
  tipo: number
  valor: number
  cupones: Cupone[]
  cuponesUsados: any[]
}

export interface Cupone {
  valorPromovar: string
  tipoPromovar: string
  urlImagenPromovar: string
  cuP_ID_CAMP: number
  cuP_ID_PROMOVAR: number
  cuP_NUM_DOC: string
  cuP_NUM_CUPON: number
  cuP_ESTADO: string
  cuP_FEC_EMISION: string
}
