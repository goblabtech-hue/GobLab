import 'dotenv/config'
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { generarDataset, DICCIONARIO } from '../../src/application/datos-abiertos'

/**
 * Contrato de los datos abiertos (SPEC §4.4g).
 *
 * Es la única superficie del sistema que consumen terceros: periodistas,
 * asociaciones, otras áreas del municipio. Romperla en silencio —quitar una
 * columna, cambiar un formato de fecha— rompe sus herramientas sin que nadie se
 * entere. Estas pruebas son el contrato.
 */

after(async () => { await prisma.$disconnect() })

describe('datos abiertos (SPEC §4.4g)', () => {
  test('publica exactamente las columnas del diccionario', async () => {
    const filas = await generarDataset()
    assert.ok(filas.length > 0)
    const primera = filas[0]
    assert.ok(primera, 'el dataset no debe venir vacío')
    assert.deepEqual(
      Object.keys(primera).sort(),
      DICCIONARIO.map((d) => d.campo).sort(),
      'el diccionario y el dataset deben coincidir campo por campo',
    )
  })

  test('no publica NINGÚN dato personal (criterio de aceptación 7)', async () => {
    const filas = await generarDataset()
    const prohibidos = [
      'telefono', 'telefonoHash', 'telefonoCifrado', 'telefonoMascara',
      'nombre', 'nombreContacto',
      // texto libre escrito por el ciudadano: puede traer nombres de vecinos
      'descripcion', 'direccion', 'direccionTexto', 'comentarioCalificacion',
    ]
    const primera = filas[0]
    assert.ok(primera, 'el dataset no debe venir vacío')
    const campos = Object.keys(primera).map((c) => c.toLowerCase())
    for (const p of prohibidos) {
      assert.ok(
        !campos.some((c) => c.includes(p.toLowerCase())),
        `el dataset no debe incluir un campo parecido a "${p}"`,
      )
    }
  })

  test('las coordenadas van redondeadas para no señalar una vivienda', async () => {
    const filas = await generarDataset()
    const conCoords = filas.filter((f) => f.lat !== null)
    assert.ok(conCoords.length > 0)
    for (const f of conCoords.slice(0, 100)) {
      const decimales = String(f.lat).split('.')[1]?.length ?? 0
      assert.ok(decimales <= 4, `lat con demasiada precisión: ${f.lat}`)
    }
  })

  test('las fechas salen sin hora, para no delatar rutinas', async () => {
    const filas = await generarDataset()
    for (const f of filas.slice(0, 50)) {
      assert.match(String(f.fecha_creacion), /^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
