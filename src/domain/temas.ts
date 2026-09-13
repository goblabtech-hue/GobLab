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

export type Tema = 'institucional' | 'federal' | 'sobrio'

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
}

export const TEMAS: Record<Tema, PaletaTema> = {
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
  },
}

export const TEMA_POR_DEFECTO: Tema = 'institucional'

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
  }
}
