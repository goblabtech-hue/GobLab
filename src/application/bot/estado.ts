import type { Prioridad } from '@/generated/prisma/enums'
import type { MensajeEntrante } from '@/infrastructure/mensajeria'
import type { Conversacion } from './conversacion'

/**
 * Estado de una conversación con el bot.
 *
 * Vive en la base (`ConversacionBot.estado`), no en memoria: un bot que olvida
 * en qué paso iba cada vez que se reinicia el servidor es inservible.
 */

export type Borrador = {
  descripcion: string
  categoriaId?: number
  prioridad?: Prioridad
  fotos: string[]
  lat?: number
  lng?: number
  coloniaId?: number
  coloniaNombre?: string
  direccionTexto?: string
  resumen?: string
}

export type Estado =
  | { paso: 'inicio' }
  | { paso: 'menu' }
  | { paso: 'describiendo' }
  | { paso: 'confirmando_categoria'; borrador: Borrador; categoriaPropuesta: number }
  | { paso: 'eligiendo_categoria'; borrador: Borrador; pagina: number }
  | { paso: 'pidiendo_foto'; borrador: Borrador }
  | { paso: 'pidiendo_ubicacion'; borrador: Borrador }
  | { paso: 'eligiendo_colonia'; borrador: Borrador; pagina: number }
  | { paso: 'confirmando'; borrador: Borrador }
  | { paso: 'ofreciendo_adhesion'; borrador: Borrador; reporteId: string; folio: string }
  | { paso: 'pidiendo_folio' }
  | { paso: 'escalado' }

export const CATEGORIAS_POR_PAGINA = 8

/** Cualquiera de estas devuelve al menú desde donde sea. */
export const PALABRAS_MENU = ['menu', 'menú', 'inicio', 'cancelar', 'salir', 'start', '/start', '0']
export const PALABRAS_HUMANO = ['humano', 'persona', 'operador', 'asesor', 'hablar con alguien', 'agente']

/** Quita acentos y mayúsculas para comparar lo que escribe la gente. */
export const normalizar = (t: string) =>
  t.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** Confirmaciones que cuentan como "sí" en cualquiera de sus formas. */
export const esAfirmativo = (clave: string) =>
  clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si')

export const esNegativo = (clave: string) =>
  clave === 'no' || clave === 'n' || clave === '2'

/**
 * Lo que todo manejador necesita para atender un mensaje.
 *
 * Los diez manejadores del flujo recibían los mismos cinco argumentos sueltos.
 * Agruparlos en un contexto los deja en dos parámetros y hace que agregar un
 * dato nuevo no obligue a tocar diez firmas.
 */
export type Contexto = {
  conversacion: Conversacion
  chatId: string
  /** El texto del ciudadano, normalizado: sin acentos, en minúsculas. */
  clave: string
  entrante: MensajeEntrante
}
