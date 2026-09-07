import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { formatearFolio, anioActual } from '../../src/domain/folio'
import { generarFolio } from '../../src/infrastructure/folio'
import { obtenerConfiguracion } from '../../src/infrastructure/config'

/** Año de pruebas: aísla estas corridas de la secuencia real del municipio. */
const ANIO_PRUEBA = 1999

/** El prefijo ahora es configurable, así que se lee de la base. */
let PREFIJO: string

before(async () => { PREFIJO = (await obtenerConfiguracion()).prefijoFolio })

after(async () => {
  await prisma.folioSecuencia.deleteMany({ where: { prefijo: PREFIJO, anio: ANIO_PRUEBA } })
  await prisma.$disconnect()
})

describe('formatearFolio', () => {
  test('usa el formato PREFIJO-AAAA-NNNNN del SPEC', () => {
    assert.equal(formatearFolio('TIZ', 2026, 341), 'TIZ-2026-00341')
  })

  test('rellena con ceros a cinco dígitos', () => {
    assert.equal(formatearFolio('MUN', 2026, 1), 'MUN-2026-00001')
  })

  test('no trunca cuando la secuencia pasa de cinco dígitos', () => {
    assert.equal(formatearFolio('MUN', 2026, 123456), 'MUN-2026-123456')
  })
})

describe('anioActual', () => {
  test('toma el año en la zona horaria del municipio, no en UTC', () => {
    // 1 de enero 03:00 UTC sigue siendo 31 de diciembre en el centro de México
    assert.equal(anioActual(new Date('2027-01-01T03:00:00Z')), 2026)
    assert.equal(anioActual(new Date('2027-01-01T09:00:00Z')), 2027)
  })
})

describe('generarFolio', () => {
  test('avanza de uno en uno', async () => {
    const fecha = new Date(`${ANIO_PRUEBA}-06-15T18:00:00Z`)
    const a = await prisma.$transaction((tx) => generarFolio(tx, fecha))
    const b = await prisma.$transaction((tx) => generarFolio(tx, fecha))
    const n = (f: string) => Number(f.split('-')[2])
    assert.equal(n(b), n(a) + 1)
  })

  test('50 reportes simultáneos obtienen 50 folios distintos (corrección C-04)', async () => {
    // Es el escenario real: WhatsApp y web creando reportes a la vez.
    // Con un COUNT(*) o un MAX(folio) aquí saldrían folios repetidos.
    const fecha = new Date(`${ANIO_PRUEBA}-06-15T18:00:00Z`)
    const antes = await prisma.folioSecuencia.findUnique({
      where: { prefijo_anio: { prefijo: PREFIJO, anio: ANIO_PRUEBA } },
    })
    const desde = antes?.ultimo ?? 0

    const folios = await Promise.all(
      Array.from({ length: 50 }, () =>
        prisma.$transaction((tx) => generarFolio(tx, fecha)),
      ),
    )

    assert.equal(new Set(folios).size, 50, 'todos los folios deben ser distintos')

    const numeros = folios.map((f) => Number(f.split('-')[2])).sort((a, b) => a - b)
    assert.deepEqual(
      numeros,
      Array.from({ length: 50 }, (_, i) => desde + i + 1),
      'la secuencia debe quedar contigua, sin huecos ni saltos',
    )
  })

  test('el año del folio sale de la fecha del reporte', async () => {
    const folio = await prisma.$transaction((tx) =>
      generarFolio(tx, new Date(`${ANIO_PRUEBA}-06-15T18:00:00Z`)),
    )
    assert.ok(folio.startsWith(`${PREFIJO}-${ANIO_PRUEBA}-`), folio)
  })
})
