import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CATALOGO_CATEGORIAS, AREAS, catalogoPorArea, categoriaMaestra } from '../../src/domain/catalogo-categorias'
import { CATEGORIAS } from '../../prisma/catalogos'

describe('catálogo maestro de problemas', () => {
  test('los slugs no se repiten', () => {
    const slugs = CATALOGO_CATEGORIAS.map((c) => c.slug)
    assert.equal(new Set(slugs).size, slugs.length)
  })

  test('las 12 categorías del SPEC están en el catálogo con el mismo slug', () => {
    // Si el seed y el catálogo divergen, activar «Bache» desde el catálogo
    // crearía una segunda categoría de baches al lado de la del seed.
    for (const c of CATEGORIAS) {
      assert.ok(categoriaMaestra(c.slug), `falta en el catálogo: ${c.slug}`)
    }
  })

  test('cada área tiene palabras para encontrar su dependencia', () => {
    for (const [area, def] of Object.entries(AREAS)) {
      assert.ok(def.palabras.length > 0, `${area} sin palabras`)
    }
  })

  test('todo problema tiene nombre en lenguaje ciudadano, descripción y plazo', () => {
    for (const c of CATALOGO_CATEGORIAS) {
      assert.ok(c.nombre.length >= 4 && c.nombre.length <= 60, c.slug)
      assert.ok(c.descripcion.length >= 10, `${c.slug} sin descripción útil`)
      assert.ok(Number.isInteger(c.sla) && c.sla >= 1 && c.sla <= 30, `${c.slug}: plazo ${c.sla}`)
      assert.ok(c.area in AREAS, `${c.slug}: área desconocida`)
    }
  })

  test('agrupado por área cubre todo el catálogo y nada más', () => {
    const total = catalogoPorArea().reduce((a, g) => a + g.categorias.length, 0)
    assert.equal(total, CATALOGO_CATEGORIAS.length)
  })

  /**
   * El componente de íconos importa uno por uno para no cargar los 1,500 de
   * Lucide. Un ícono nuevo en el catálogo que no esté ahí se dibuja como «?»
   * y nadie lo nota hasta verlo en pantalla.
   */
  test('todos los íconos del catálogo están mapeados en el componente', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'components', 'icono-categoria.tsx'), 'utf-8',
    )
    const mapa = src.slice(src.indexOf('const ICONOS'), src.indexOf('}', src.indexOf('const ICONOS')))
    for (const c of CATALOGO_CATEGORIAS) {
      const clave = c.icono.includes('-') ? `'${c.icono}'` : c.icono
      assert.ok(mapa.includes(`${clave}:`), `ícono sin mapear: ${c.icono} (${c.slug})`)
    }
  })

  test('los riesgos para la gente tienen plazos de un día o dos', () => {
    // Una coladera abierta o un cable caído no pueden tener el plazo de una
    // banqueta. Si alguien sube estos plazos, que lo haga a propósito.
    for (const slug of ['coladera-sin-tapa', 'poste-riesgo', 'cables', 'deslave', 'fuga-drenaje']) {
      assert.ok(categoriaMaestra(slug)!.sla <= 2, `${slug} debe ser urgente`)
    }
  })
})
