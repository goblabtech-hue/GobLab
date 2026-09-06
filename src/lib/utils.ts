import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "hace 3 días", "hace 2 meses" — lenguaje ciudadano, no timestamps crudos. */
export function haceCuanto(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const seg = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seg < 60) return 'hace unos segundos'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} ${hrs === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(hrs / 24)
  if (dias < 31) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

const fmtFecha = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'long', year: 'numeric',
  timeZone: process.env.NEXT_PUBLIC_MUNICIPIO_TZ ?? 'America/Mexico_City',
})
const fmtFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: process.env.NEXT_PUBLIC_MUNICIPIO_TZ ?? 'America/Mexico_City',
})

export const fecha = (d: Date | string) =>
  fmtFecha.format(typeof d === 'string' ? new Date(d) : d)
export const fechaHora = (d: Date | string) =>
  fmtFechaHora.format(typeof d === 'string' ? new Date(d) : d)

export const numero = (n: number) => new Intl.NumberFormat('es-MX').format(n)
export const pct = (n: number, dec = 0) =>
  `${new Intl.NumberFormat('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)}%`
