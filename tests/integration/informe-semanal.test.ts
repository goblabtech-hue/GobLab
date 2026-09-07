import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { informeSemanal } from '../../src/application/reportes/informe-semanal'
import { semanaDe, semanaAnterior } from '../../src/domain/semana'

/**
 * El informe se prueba sobre una dependencia propia, creada para la prueba.
 * Contarlo sobre las del seed haría que el resultado dependiera de datos que
 * cambian cada vez que alguien resiembra, y las suites corren en paralelo.
 */

const DIA = 86_400_000

// Una semana bien lejos del presente: así los reportes de la prueba no se
// mezclan con los del seed ni con lo que hagan las otras suites.
const SEMANA = semanaDe(new Date('2025-03-12T15:00:00Z')) // miércoles
const PREVIA = semanaAnterior(SEMANA)

let dependenciaId: number
let categoriaId: number
const creados: string[] = []

/** Crea un reporte con fechas puestas a mano, saltándose el flujo normal. */
async function reporte(datos: {
  folio: string
  createdAt: Date
  fechaLimite: Date
  resueltoAt?: Date | null
  estatus?: 'nuevo' | 'asignado' | 'en_atencion' | 'resuelto' | 'cerrado'
}) {
  const r = await prisma.reporte.create({
    data: {
      folio: datos.folio,
      categoriaId,
      dependenciaId,
      descripcion: `prueba informe semanal ${datos.folio}`,
      origen: 'web',
      estatus: datos.estatus ?? (datos.resueltoAt ? 'resuelto' : 'nuevo'),
      createdAt: datos.createdAt,
      fechaLimite: datos.fechaLimite,
      slaDiasHabilesAplicado: 5,
      resueltoAt: datos.resueltoAt ?? null,
    },
    select: { id: true },
  })
  creados.push(r.id)
  return r.id
}

before(async () => {
  const d = await prisma.dependencia.create({
    data: {
      nombre: `Dependencia de prueba ${Date.now()}`,
      responsable: 'Responsable de prueba',
      telefono: '7730000000',
      correo: 'prueba@ejemplo.mx',
    },
    select: { id: true },
  })
  dependenciaId = d.id

  const c = await prisma.categoria.create({
    data: {
      nombre: `Categoría de prueba ${Date.now()}`,
      slug: `prueba-${Date.now()}`,
      icono: 'wrench',
      slaDiasHabiles: 5,
      dependenciaId,
      orden: 999,
      activa: false, // no debe aparecer en el menú del bot ni en /reportar
    },
    select: { id: true },
  })
  categoriaId = c.id
})

after(async () => {
  // Se borra por categoría y no por la lista de ids: si una aserción falla a
  // media prueba, los reportes creados después no alcanzan a registrarse y
  // dejarían la categoría sin poder borrarse.
  if (categoriaId) await prisma.reporte.deleteMany({ where: { categoriaId } })
  if (categoriaId) await prisma.categoria.deleteMany({ where: { id: categoriaId } })
  if (dependenciaId) await prisma.dependencia.deleteMany({ where: { id: dependenciaId } })
  await prisma.$disconnect()
})

describe('lo que se hizo en la semana', () => {
  test('cuenta solo lo resuelto dentro de la semana, y separa a tiempo de tarde', async () => {
    const marca = Date.now()
    const dentro = new Date(SEMANA.inicio.getTime() + 2 * DIA)
    const limite = new Date(SEMANA.inicio.getTime() + 3 * DIA)

    // Dos a tiempo, uno tarde.
    await reporte({ folio: `T${marca}-1`, createdAt: new Date(SEMANA.inicio.getTime() - DIA), fechaLimite: limite, resueltoAt: dentro })
    await reporte({ folio: `T${marca}-2`, createdAt: new Date(SEMANA.inicio.getTime() - DIA), fechaLimite: limite, resueltoAt: dentro })
    await reporte({ folio: `T${marca}-3`, createdAt: new Date(SEMANA.inicio.getTime() - DIA), fechaLimite: dentro, resueltoAt: limite })
    // Uno resuelto en la semana anterior: no debe contar aquí.
    await reporte({ folio: `T${marca}-4`, createdAt: new Date(PREVIA.inicio.getTime()), fechaLimite: new Date(PREVIA.fin.getTime()), resueltoAt: new Date(PREVIA.inicio.getTime() + DIA) })

    const inf = await informeSemanal(SEMANA, dependenciaId)
    const d = inf.dependencias[0]!

    assert.equal(d.resueltos, 3, 'solo los tres de esta semana')
    assert.equal(d.aTiempo, 2)
    assert.equal(d.fueraDeTiempo, 1)
    assert.ok(Math.abs(d.cumplimiento! - 66.67) < 0.1, `cumplimiento: ${d.cumplimiento}`)
  })

  test('sin nada resuelto el cumplimiento es null, no 0%', async () => {
    // Un área que no cerró nada no cumplió el 0%: no hay dato. Pintarla de
    // rojo al 0% sería acusarla de algo que no ocurrió.
    const vacia = await prisma.dependencia.create({
      data: { nombre: `Vacía ${Date.now()}`, responsable: 'X', telefono: '7730000001' },
      select: { id: true },
    })
    const inf = await informeSemanal(SEMANA, vacia.id)
    assert.equal(inf.dependencias[0]!.resueltos, 0)
    assert.equal(inf.dependencias[0]!.cumplimiento, null)
    await prisma.dependencia.delete({ where: { id: vacia.id } })
  })

  test('compara contra la semana anterior', async () => {
    const inf = await informeSemanal(SEMANA, dependenciaId)
    const d = inf.dependencias[0]!
    assert.equal(d.resueltosPrevio, 1, 'el de la semana pasada')
    assert.equal(d.cumplimientoPrevio, 100)
  })
})

describe('el corte de la semana en hora de México', () => {
  /**
   * El caso que justifica el módulo de semanas: un reporte resuelto el domingo
   * por la tarde ya es lunes en UTC. Si el corte se hiciera en UTC, ese trabajo
   * saldría del informe de la semana que cerró y la cuadrilla vería un número
   * que no cuadra con lo que hizo.
   */
  test('lo resuelto el domingo por la tarde cuenta en la semana que cierra', async () => {
    const marca = Date.now()
    // Domingo de SEMANA, 18:30 hora de México = lunes 00:30 UTC.
    const domingoTarde = new Date(SEMANA.fin.getTime() - 5.5 * 3_600_000)
    assert.equal(domingoTarde.getUTCDay(), 1, 'en UTC ya cayó en lunes')

    await reporte({
      folio: `D${marca}`,
      createdAt: new Date(SEMANA.inicio.getTime()),
      fechaLimite: new Date(SEMANA.fin.getTime()),
      resueltoAt: domingoTarde,
    })

    const estaSemana = await informeSemanal(SEMANA, dependenciaId)
    const siguiente = await informeSemanal(semanaAnterior(SEMANA), dependenciaId)

    assert.equal(estaSemana.dependencias[0]!.resueltos, 4, 'suma a la semana que cierra')
    assert.equal(siguiente.dependencias[0]!.resueltos, 1, 'la anterior no se mueve')
  })
})

describe('lo que queda pendiente', () => {
  test('cuenta los abiertos de hoy y marca los vencidos', async () => {
    const marca = Date.now()
    const hace30 = new Date(Date.now() - 30 * DIA)
    // Abierto y vencido: el plazo era hace 25 días.
    await reporte({ folio: `P${marca}-1`, createdAt: hace30, fechaLimite: new Date(Date.now() - 25 * DIA), estatus: 'asignado' })
    // Abierto y en tiempo: vence en 5 días.
    await reporte({ folio: `P${marca}-2`, createdAt: new Date(), fechaLimite: new Date(Date.now() + 5 * DIA), estatus: 'nuevo' })

    const inf = await informeSemanal(SEMANA, dependenciaId)
    const d = inf.dependencias[0]!

    assert.equal(d.pendientes, 2)
    assert.equal(d.pendientesVencidos, 1, 'solo el que pasó su fecha límite')

    const viejo = d.masViejos[0]!
    assert.equal(viejo.folio, `P${marca}-1`, 'el más viejo va primero')
    assert.ok(viejo.diasAbierto >= 29, `días abierto: ${viejo.diasAbierto}`)
    assert.ok(viejo.diasVencido >= 24, `días vencido: ${viejo.diasVencido}`)
    assert.equal(d.masViejos[1]!.diasVencido, 0, 'el que está en tiempo no reporta días vencidos')
  })

  test('un reporte cerrado ya no es pendiente', async () => {
    const marca = Date.now()
    await reporte({
      folio: `C${marca}`, createdAt: new Date(Date.now() - 10 * DIA),
      fechaLimite: new Date(Date.now() - 5 * DIA),
      resueltoAt: new Date(Date.now() - 6 * DIA), estatus: 'cerrado',
    })
    const inf = await informeSemanal(SEMANA, dependenciaId)
    assert.equal(inf.dependencias[0]!.pendientes, 2, 'siguen siendo los dos abiertos')
  })
})

describe('alcance', () => {
  test('al pedir una dependencia solo se ve esa', async () => {
    const inf = await informeSemanal(SEMANA, dependenciaId)
    assert.equal(inf.dependencias.length, 1)
    assert.equal(inf.dependencias[0]!.id, dependenciaId)
  })

  test('los totales cuadran con la suma de las áreas', async () => {
    const inf = await informeSemanal(SEMANA)
    assert.equal(
      inf.totales.resueltos,
      inf.dependencias.reduce((a, d) => a + d.resueltos, 0),
    )
    assert.equal(
      inf.totales.pendientesVencidos,
      inf.dependencias.reduce((a, d) => a + d.pendientesVencidos, 0),
    )
  })

  test('trae los datos de contacto del responsable, para saber a quién llamar', async () => {
    const inf = await informeSemanal(SEMANA, dependenciaId)
    assert.equal(inf.dependencias[0]!.responsable, 'Responsable de prueba')
    assert.equal(inf.dependencias[0]!.correo, 'prueba@ejemplo.mx')
  })
})
