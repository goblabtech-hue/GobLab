import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { TEMAS, esTema, variablesDeTema, type Tema } from '../../src/domain/temas'

/**
 * Contraste según WCAG 2: luminancia relativa y razón entre los dos colores.
 * Se calcula aquí mismo para que la prueba no dependa de ninguna librería.
 */
function luminancia(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}
function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1! + 0.05) / (l2! + 0.05)
}

const temas = Object.keys(TEMAS) as Tema[]

describe('los tres temas', () => {
  test('existen los tres que pide la configuración', () => {
    assert.deepEqual(temas.sort(), ['federal', 'institucional', 'sobrio'])
  })

  test('todos definen exactamente las mismas variables', () => {
    const referencia = Object.keys(variablesDeTema('institucional')).sort()
    for (const t of temas) {
      assert.deepEqual(Object.keys(variablesDeTema(t)).sort(), referencia, `${t} define otras variables`)
    }
  })

  test('esTema rechaza lo que no es un tema', () => {
    assert.equal(esTema('federal'), true)
    assert.equal(esTema('morado'), false)
    assert.equal(esTema(''), false)
    assert.equal(esTema(null), false)
    assert.equal(esTema(42), false)
  })
})

describe('legibilidad', () => {
  /**
   * WCAG AA pide 4.5:1 para texto normal. Es la prueba que importa: un tema
   * con cabecera guinda y texto guinda pasaría cualquier revisión de código
   * y sería ilegible.
   */
  for (const t of temas) {
    const p = TEMAS[t]
    test(`${t}: el texto de la cabecera se lee sobre su fondo`, () => {
      const r = contraste(p.cabecera.texto, p.cabecera.fondo)
      assert.ok(r >= 4.5, `contraste ${r.toFixed(2)}:1, mínimo 4.5:1`)
    })
    test(`${t}: la tinta se lee sobre el papel y sobre el lienzo`, () => {
      assert.ok(contraste(p.tinta, p.papel) >= 4.5)
      assert.ok(contraste(p.tinta, p.lienzo) >= 4.5)
      assert.ok(contraste(p.tintaSuave, p.papel) >= 4.5, 'el texto secundario también')
    })
    test(`${t}: el blanco se lee sobre el color de acción (botones)`, () => {
      const r = contraste('#ffffff', p.marca[600])
      assert.ok(r >= 4.5, `contraste ${r.toFixed(2)}:1 sobre marca-600`)
    })
    test(`${t}: el color de marca se lee sobre su fondo suave (insignias)`, () => {
      const r = contraste(p.marca[700], p.marca[50])
      assert.ok(r >= 4.5, `contraste ${r.toFixed(2)}:1 de marca-700 sobre marca-50`)
    })
  }
})

describe('el tema federal es el del Gobierno de México', () => {
  test('guinda y oro, del manual de identidad gráfica', () => {
    const f = TEMAS.federal
    assert.equal(f.marca[500].toLowerCase(), '#9f2241', 'guinda')
    assert.equal(f.cabecera.fondo.toLowerCase(), '#611232', 'guinda oscuro en la cabecera')
    assert.equal(f.cabecera.acento.toLowerCase(), '#bc955c', 'línea de oro')
  })
})
