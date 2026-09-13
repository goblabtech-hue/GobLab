/**
 * Identidad visual de una dependencia: un ícono y un color.
 *
 * Con nueve áreas de nombres largos («Dirección de Obras Públicas, Desarrollo
 * Urbano y Catastro»), en una lista de reportes el nombre no se lee de un
 * vistazo; el sello sí. El ícono dice qué hace el área; el color la distingue
 * de las demás aunque dos tengan íconos parecidos.
 */

export const ICONOS_DEPENDENCIA = [
  ['building-2', 'Edificio (genérico)'],
  ['truck', 'Camión (servicios, limpia)'],
  ['hard-hat', 'Casco (obras)'],
  ['droplets', 'Gotas (agua)'],
  ['shield-check', 'Escudo (seguridad)'],
  ['leaf', 'Hoja (ambiente)'],
  ['scroll-text', 'Reglamento'],
  ['heart-pulse', 'Salud'],
  ['eye', 'Transparencia'],
  ['siren', 'Sirena (protección civil)'],
  ['lightbulb', 'Foco (alumbrado)'],
  ['trees', 'Árboles (parques)'],
  ['landmark', 'Edificio público'],
  ['scale', 'Balanza (jurídico)'],
  ['bus', 'Transporte'],
  ['wrench', 'Llave (mantenimiento)'],
  ['users', 'Personas (desarrollo social)'],
  ['recycle', 'Reciclaje'],
  ['store', 'Comercio (mercados)'],
  ['home', 'Vivienda'],
] as const

export type IconoDependencia = (typeof ICONOS_DEPENDENCIA)[number][0]

/** Colores con fondo claro y trazo oscuro: legibles en tarjetas blancas y en tablas. */
export const COLORES_DEPENDENCIA = {
  verde:    { nombre: 'Verde',    fondo: '#d2f2e6', trazo: '#0a6a52' },
  azul:     { nombre: 'Azul',     fondo: '#dbeafe', trazo: '#1e40af' },
  cian:     { nombre: 'Cian',     fondo: '#cffafe', trazo: '#0e7490' },
  naranja:  { nombre: 'Naranja',  fondo: '#ffedd5', trazo: '#c2410c' },
  rojo:     { nombre: 'Rojo',     fondo: '#fee2e2', trazo: '#b42318' },
  morado:   { nombre: 'Morado',   fondo: '#ede9fe', trazo: '#6d28d9' },
  rosa:     { nombre: 'Rosa',     fondo: '#fce7f3', trazo: '#be185d' },
  ambar:    { nombre: 'Ámbar',    fondo: '#fef3c7', trazo: '#92400e' },
  gris:     { nombre: 'Gris',     fondo: '#e5e7eb', trazo: '#374151' },
  marino:   { nombre: 'Marino',   fondo: '#dbe4f3', trazo: '#0b1a33' },
} as const

export type ColorDependencia = keyof typeof COLORES_DEPENDENCIA

export const ICONO_DEPENDENCIA_POR_DEFECTO: IconoDependencia = 'building-2'
export const COLOR_DEPENDENCIA_POR_DEFECTO: ColorDependencia = 'gris'

export function colorDependencia(color: string | null | undefined) {
  return COLORES_DEPENDENCIA[(color ?? '') as ColorDependencia] ?? COLORES_DEPENDENCIA[COLOR_DEPENDENCIA_POR_DEFECTO]
}
