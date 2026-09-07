/**
 * Render de Markdown mínimo para documentos legales.
 *
 * Se escribe a mano en vez de traer una librería por dos razones: el aviso de
 * privacidad solo necesita encabezados, párrafos, listas y negritas; y el texto
 * lo pega una persona desde un documento externo, así que **escapar el HTML
 * antes de aplicar cualquier formato** no es negociable. Un parser completo
 * traería opciones de HTML crudo que aquí solo serían una vía de inyección.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)
}

/** Negritas, cursivas y enlaces, sobre texto YA escapado. */
function enLinea(texto: string): string {
  return texto
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    // Solo se aceptan http(s) y mailto: un enlace javascript: sería ejecutable.
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '<a href="$2" rel="noreferrer">$1</a>',
    )
}

export function markdownAHtml(fuente: string): string {
  const lineas = escapar(fuente.replace(/\r\n/g, '\n')).split('\n')
  const salida: string[] = []
  let enLista = false
  let enCita = false

  const cerrarLista = () => {
    if (enLista) { salida.push('</ul>'); enLista = false }
  }
  const cerrarCita = () => {
    if (enCita) { salida.push('</blockquote>'); enCita = false }
  }

  for (const linea of lineas) {
    const l = linea.trim()

    if (!l) { cerrarLista(); cerrarCita(); continue }

    // Cita: varias líneas seguidas con ">" forman un solo bloque.
    const cita = /^&gt;\s?(.*)$/.exec(l)
    if (cita) {
      cerrarLista()
      if (!enCita) { salida.push('<blockquote>'); enCita = true }
      salida.push(`<p>${enLinea(cita[1] ?? '')}</p>`)
      continue
    }
    cerrarCita()

    const encabezado = /^(#{1,4})\s+(.*)$/.exec(l)
    if (encabezado) {
      cerrarLista()
      const nivel = Math.min(6, encabezado[1]!.length + 1) // # -> h2, para no competir con el h1 de la página
      salida.push(`<h${nivel}>${enLinea(encabezado[2] ?? '')}</h${nivel}>`)
      continue
    }

    const item = /^[-*•]\s+(.*)$/.exec(l) ?? /^\d+[.)]\s+(.*)$/.exec(l)
    if (item) {
      if (!enLista) { salida.push('<ul>'); enLista = true }
      salida.push(`<li>${enLinea(item[1] ?? '')}</li>`)
      continue
    }

    cerrarLista()
    salida.push(`<p>${enLinea(l)}</p>`)
  }

  cerrarLista()
  cerrarCita()
  return salida.join('\n')
}

/** Primeras palabras del documento, para la vista de historial. */
export function resumen(fuente: string, maximo = 140): string {
  const plano = fuente.replace(/[#*_>[\]()]/g, ' ').replace(/\s+/g, ' ').trim()
  return plano.length <= maximo ? plano : `${plano.slice(0, maximo)}…`
}
