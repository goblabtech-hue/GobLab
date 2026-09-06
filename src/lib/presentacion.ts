import type { EstatusReporte, OrigenReporte, Prioridad } from '@/generated/prisma/enums'
import type { Tono } from '@/components/ui/insignia'

/**
 * Lenguaje ciudadano (SPEC §4.4 y Notas finales): "Tu reporte de bache fue
 * recibido", no "Su solicitud fue turnada a la dependencia competente".
 * Cada estatus tiene dos textos: el que ve el ciudadano y el interno.
 */

export const ESTATUS: Record<
  EstatusReporte,
  { ciudadano: string; interno: string; tono: Tono; explicacion: string }
> = {
  nuevo: {
    ciudadano: 'Recibido',
    interno: 'Nuevo',
    tono: 'azul',
    explicacion: 'Ya tenemos tu reporte y lo estamos revisando.',
  },
  asignado: {
    ciudadano: 'Asignado a una cuadrilla',
    interno: 'Asignado',
    tono: 'azul',
    explicacion: 'Tu reporte ya tiene un equipo responsable.',
  },
  en_atencion: {
    ciudadano: 'En atención',
    interno: 'En atención',
    tono: 'marca',
    explicacion: 'La cuadrilla está trabajando en tu reporte.',
  },
  resuelto: {
    ciudadano: 'Resuelto',
    interno: 'Resuelto',
    tono: 'verde',
    explicacion: 'Terminamos el trabajo. Cuéntanos qué te pareció.',
  },
  cerrado: {
    ciudadano: 'Cerrado',
    interno: 'Cerrado',
    tono: 'verde',
    explicacion: 'Este reporte quedó concluido.',
  },
  reabierto: {
    ciudadano: 'Reabierto',
    interno: 'Reabierto',
    tono: 'ambar',
    explicacion: 'Nos dijiste que el problema sigue. Lo estamos revisando otra vez.',
  },
  duplicado: {
    ciudadano: 'Unido a otro reporte',
    interno: 'Duplicado',
    tono: 'neutro',
    explicacion: 'Alguien más ya había reportado esto. Le damos seguimiento en un solo folio.',
  },
  improcedente: {
    ciudadano: 'No procede',
    interno: 'Improcedente',
    tono: 'neutro',
    explicacion: 'Este caso no lo puede atender el municipio. Aquí te explicamos por qué.',
  },
}

export const ESTATUS_ABIERTOS: EstatusReporte[] = ['nuevo', 'asignado', 'en_atencion', 'reabierto']
export const ESTATUS_CERRADOS: EstatusReporte[] = ['resuelto', 'cerrado']

export const PRIORIDAD: Record<Prioridad, { texto: string; tono: Tono }> = {
  normal: { texto: 'Normal', tono: 'neutro' },
  alta: { texto: 'Alta', tono: 'ambar' },
  urgente: { texto: 'Urgente', tono: 'rojo' },
}

export const ORIGEN: Record<OrigenReporte, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  web: 'Sitio web',
  telefono: 'Teléfono',
  ventanilla: 'Ventanilla',
}

export const SEMAFORO: Record<'verde' | 'ambar' | 'rojo', { texto: string; tono: Tono }> = {
  verde: { texto: 'En tiempo', tono: 'verde' },
  ambar: { texto: 'Por vencer', tono: 'ambar' },
  rojo: { texto: 'Vencido', tono: 'rojo' },
}

export const ROL: Record<string, string> = {
  operador: 'Atención ciudadana',
  cuadrilla: 'Cuadrilla',
  supervisor: 'Supervisión',
  admin: 'Administración',
}

/** Ruta de inicio según el rol, para mandar a cada quien a su pantalla. */
export function inicioPorRol(rol: string): string {
  switch (rol) {
    case 'cuadrilla': return '/cuadrilla'
    case 'admin': return '/ejecutivo'
    case 'supervisor': return '/ejecutivo'
    default: return '/bandeja'
  }
}
