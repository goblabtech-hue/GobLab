import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { markdownAHtml, resumen } from '../../src/domain/markdown'

/**
 * El aviso de privacidad lo pega una persona desde un documento externo, y este
 * módulo decide qué HTML se sirve al ciudadano. El escapado no es un detalle de
 * estilo: es la única barrera entre un texto pegado y una inyección.
 */

describe('escapado', () => {
  test('neutraliza etiquetas HTML pegadas en el texto', () => {
    const html = markdownAHtml('Hola <script>alert(1)</script> mundo')
    assert.ok(!html.includes('<script>'), 'no debe emitir la etiqueta')
    assert.ok(html.includes('&lt;script&gt;'), 'debe quedar escapada y visible')
  })

  test('neutraliza atributos de evento', () => {
    const html = markdownAHtml('<img src=x onerror="alert(1)">')
    assert.ok(!html.includes('<img'), 'no debe emitir la etiqueta')
    assert.ok(!/onerror=/.test(html.replace(/&quot;/g, '')) || html.includes('&lt;img'))
  })

  test('un enlace javascript: no se convierte en enlace', () => {
    const html = markdownAHtml('[clic](javascript:alert(1))')
    assert.ok(!html.includes('<a '), 'solo se aceptan http, https y mailto')
    assert.ok(html.includes('[clic]'), 'se queda como texto plano')
  })

  test('los enlaces http y mailto sí funcionan', () => {
    assert.ok(markdownAHtml('[INAI](https://home.inai.org.mx)').includes('<a href="https://home.inai.org.mx"'))
    assert.ok(markdownAHtml('[correo](mailto:transparencia@municipio.gob.mx)').includes('mailto:'))
  })
})

describe('formato', () => {
  test('los encabezados empiezan en h2, para no competir con el título de la página', () => {
    assert.ok(markdownAHtml('# Apartado').includes('<h2>Apartado</h2>'))
    assert.ok(markdownAHtml('## Subapartado').includes('<h3>Subapartado</h3>'))
  })

  test('agrupa las viñetas en una sola lista', () => {
    const html = markdownAHtml('- uno\n- dos\n- tres')
    assert.equal(html.match(/<ul>/g)?.length, 1)
    assert.equal(html.match(/<li>/g)?.length, 3)
  })

  test('acepta viñetas numeradas y con guion medio', () => {
    assert.ok(markdownAHtml('1. uno\n2. dos').includes('<li>uno</li>'))
    assert.ok(markdownAHtml('• uno').includes('<li>uno</li>'))
  })

  test('varias líneas de cita forman un solo bloque', () => {
    const html = markdownAHtml('> primera\n> segunda\n\nsuelto')
    assert.equal(html.match(/<blockquote>/g)?.length, 1)
    assert.ok(html.includes('<p>primera</p>'))
    assert.ok(html.includes('<p>suelto</p>'))
  })

  test('negritas y cursivas', () => {
    assert.ok(markdownAHtml('esto es **importante**').includes('<strong>importante</strong>'))
    assert.ok(markdownAHtml('esto va *inclinado*').includes('<em>inclinado</em>'))
  })

  test('un texto sin formato sale como párrafos', () => {
    const html = markdownAHtml('Primer párrafo.\n\nSegundo párrafo.')
    assert.equal(html.match(/<p>/g)?.length, 2)
  })

  test('un documento vacío no revienta', () => {
    assert.equal(markdownAHtml(''), '')
    assert.equal(markdownAHtml('\n\n  \n'), '')
  })
})

describe('resumen', () => {
  test('quita las marcas y recorta', () => {
    assert.equal(resumen('## Título\n\n**Texto** en negritas', 20), 'Título Texto en negr…')
  })

  test('un texto corto se devuelve entero', () => {
    assert.equal(resumen('corto'), 'corto')
  })
})

describe('normalización de saltos de línea', () => {
  test('un documento pegado desde Windows se ve igual que uno de Mac', () => {
    const conCrlf = markdownAHtml('## Uno\r\n\r\n- a\r\n- b')
    const conLf = markdownAHtml('## Uno\n\n- a\n- b')
    assert.equal(conCrlf, conLf)
  })
})
