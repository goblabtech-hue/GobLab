/**
 * Identidades visuales de la plataforma.
 *
 * Tres, seleccionables desde /admin/municipio. Cada una cambia la paleta de
 * marca, los neutros y la cabecera — y nada más. Los colores de semáforo
 * (verde, ámbar, rojo) son iguales en las tres a propósito: significan
 * «en tiempo», «por vencer», «vencido», y un rojo que cambia de tono según la
 * identidad deja de ser una señal.
 *
 * Vive en el dominio como datos y no en el CSS porque el selector de
 * administración necesita pintar una vista previa, y el correo y las gráficas
 * necesitan los mismos valores fuera del navegador.
 */

export type Tema = 'demoscopia' | 'institucional' | 'federal' | 'sobrio'

export type PaletaTema = {
  nombre: string
  descripcion: string
  /** Escala de la marca: fondos suaves (50–200), acción (500–700), énfasis (900). */
  marca: { 50: string; 100: string; 200: string; 500: string; 600: string; 700: string; 900: string }
  /** Texto y superficies. */
  tinta: string
  tintaSuave: string
  tenue: string
  papel: string
  lienzo: string
  borde: string
  /** La barra superior: fondo, texto y una línea de acento debajo. */
  cabecera: { fondo: string; texto: string; acento: string }
  /**
   * Degradado de marca, si la identidad lo usa. Va en los botones de acción y
   * en la línea de la cabecera. Dos paradas, de izquierda a derecha.
   */
  gradiente?: [string, string]
  /** Fuente propia de la identidad. Debe estar cargada en el layout raíz. */
  fuente?: 'montserrat'
  /** Qué versión del logotipo se lee sobre la cabecera. */
  logotipo: 'color' | 'blanco'
}

export const TEMAS: Record<Tema, PaletaTema> = {
  /**
   * La identidad de Demoscopia Digital, tomada de demoscopiadigital.com:
   * fondo blanco, titulares gris marino, degradado cian → azul en las
   * acciones, verde de acento y Montserrat. Es la oficial de la plataforma.
   */
  demoscopia: {
    nombre: 'Demoscopia',
    descripcion: 'La identidad oficial: cian y azul con Montserrat, como demoscopiadigital.com.',
    marca: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bedbff',
      500: '#2b7fff', 600: '#155dfc', 700: '#1447e6', 900: '#1c398e',
    },
    tinta: '#101828', tintaSuave: '#4a5565', tenue: '#6a7282',
    papel: '#ffffff', lienzo: '#f9fafb', borde: '#e5e7eb',
    cabecera: { fondo: '#ffffff', texto: '#101828', acento: '#155dfc' },
    // El sitio usa cian-500 (#00b8db) → azul-600. Con texto blanco, la punta
    // cian da 2.4:1 de contraste, muy por debajo del 4.5:1 que exige WCAG AA
    // — un defecto de su web, no de su identidad. Aquí la punta cian es
    // cian-700 (#007595, 5.3:1): sigue siendo cian → azul, y se lee bajo el
    // sol en un celular, que es donde la gente usa esto.
    gradiente: ['#007595', '#155dfc'],
    fuente: 'montserrat',
    logotipo: 'color',
  },

  institucional: {
    nombre: 'Institucional',
    descripcion: 'Verde de la plataforma, neutro y limpio. Sirve para cualquier municipio.',
    marca: {
      50: '#edfaf5', 100: '#d2f2e6', 200: '#a7e5ce',
      500: '#14a37b', 600: '#0d8465', 700: '#0a6a52', 900: '#06382c',
    },
    tinta: '#10251f', tintaSuave: '#4a5f59', tenue: '#7c8c87',
    papel: '#ffffff', lienzo: '#f4f7f5', borde: '#dfe6e2',
    cabecera: { fondo: '#ffffff', texto: '#0a6a52', acento: '#0d8465' },
    logotipo: 'color',
  },

  /**
   * Guinda y oro: la identidad gráfica del Gobierno de México. Los valores
   * son los del manual de identidad federal (guinda #9F2241 y #611232, oro
   * #BC955C). La cabecera va en guinda oscuro con una línea de oro debajo,
   * que es la composición que la gente reconoce de gob.mx.
   */
  federal: {
    nombre: 'Gobierno de México',
    descripcion: 'Guinda y oro, empatado con la identidad gráfica federal.',
    marca: {
      50: '#fbf1f4', 100: '#f4dbe3', 200: '#e6b3c3',
      500: '#9f2241', 600: '#8a1c39', 700: '#611232', 900: '#3a0a1e',
    },
    tinta: '#231a1d', tintaSuave: '#5c4f53', tenue: '#8a7f82',
    papel: '#ffffff', lienzo: '#f7f4f2', borde: '#e6dedb',
    cabecera: { fondo: '#611232', texto: '#ffffff', acento: '#bc955c' },
    logotipo: 'blanco',
  },

  /** Grises y negro. Sin color de marca: la jerarquía la hace el contraste. */
  sobrio: {
    nombre: 'Sobrio',
    descripcion: 'Grises y negro, sin color de marca. Formal y discreto.',
    marca: {
      50: '#f5f5f5', 100: '#e8e8e8', 200: '#cfcfcf',
      500: '#3d3d3d', 600: '#262626', 700: '#171717', 900: '#0a0a0a',
    },
    tinta: '#111111', tintaSuave: '#4d4d4d', tenue: '#808080',
    papel: '#ffffff', lienzo: '#f4f4f4', borde: '#dcdcdc',
    cabecera: { fondo: '#111111', texto: '#ffffff', acento: '#8c8c8c' },
    logotipo: 'blanco',
  },
}

export const TEMA_POR_DEFECTO: Tema = 'demoscopia'

export function esTema(valor: unknown): valor is Tema {
  return typeof valor === 'string' && valor in TEMAS
}

/** Las variables CSS de un tema, listas para inyectar en `<html style>`. */
export function variablesDeTema(tema: Tema): Record<string, string> {
  const t = TEMAS[tema]
  return {
    '--color-marca-50': t.marca[50],
    '--color-marca-100': t.marca[100],
    '--color-marca-200': t.marca[200],
    '--color-marca-500': t.marca[500],
    '--color-marca-600': t.marca[600],
    '--color-marca-700': t.marca[700],
    '--color-marca-900': t.marca[900],
    '--color-tinta': t.tinta,
    '--color-tinta-suave': t.tintaSuave,
    '--color-tenue': t.tenue,
    '--color-papel': t.papel,
    '--color-lienzo': t.lienzo,
    '--color-borde': t.borde,
    '--color-cabecera': t.cabecera.fondo,
    '--color-cabecera-texto': t.cabecera.texto,
    '--color-cabecera-acento': t.cabecera.acento,
    // Sin degradado, las dos paradas son el mismo color: el CSS no necesita
    // saber si la identidad lo usa o no.
    '--gradiente-a': t.gradiente?.[0] ?? t.marca[600],
    '--gradiente-b': t.gradiente?.[1] ?? t.marca[600],
    '--fuente-tema': t.fuente === 'montserrat' ? 'var(--font-montserrat)' : 'var(--font-inter)',
  }
}
