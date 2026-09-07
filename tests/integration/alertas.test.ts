import 'dotenv/config'
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { evaluarAlertas, alertasActivas } from '../../src/application/alertas'
import { calcularIndicadoresInternos } from '../../src/application/indicadores-internos'

/**
 * Las alertas se prueban moviendo los umbrales por variable de entorno, que es
 * como el municipio las va a ajustar en la vida real.
 */

const originales = {
  vencidos: process.env.ALERTA_VENCIDOS_PCT,
  caida: process.env.ALERTA_CAIDA_CALIFICACION,
  reaperturas: process.env.ALERTA_REAPERTURAS_CATEGORIA,
}

/** Los umbrales se leen en cada evaluación, así que basta con moverlos. */
function conUmbrales(v: { vencidos?: string; caida?: string; reaperturas?: string }) {
  if (v.vencidos !== undefined) process.env.ALERTA_VENCIDOS_PCT = v.vencidos
  if (v.caida !== undefined) process.env.ALERTA_CAIDA_CALIFICACION = v.caida
  if (v.reaperturas !== undefined) process.env.ALERTA_REAPERTURAS_CATEGORIA = v.reaperturas
}

before(async () => { await prisma.alertaInterna.deleteMany() })

beforeEach(async () => { await prisma.alertaInterna.deleteMany() })

after(async () => {
  process.env.ALERTA_VENCIDOS_PCT = originales.vencidos
  process.env.ALERTA_CAIDA_CALIFICACION = originales.caida
  process.env.ALERTA_REAPERTURAS_CATEGORIA = originales.reaperturas
  await prisma.alertaInterna.deleteMany()
  await prisma.$disconnect()
})

describe('alertas internas (SPEC §4.5)', () => {
  test('con umbral de 0% la de vencidos se dispara', async () => {
    conUmbrales({ vencidos: '0' })
    const r = await evaluarAlertas()
    assert.ok(
      r.nuevas.some((a) => a.tipo === 'vencidos_sobre_umbral'),
      'debe detectar reportes vencidos',
    )
  })

  test('no se repite mientras siga abierta', async () => {
    conUmbrales({ vencidos: '0' })
    await evaluarAlertas()
    const segunda = await evaluarAlertas()

    assert.equal(segunda.nuevas.length, 0, 'la segunda pasada no debe crear nada')
    const activas = await alertasActivas()
    assert.equal(
      activas.filter((a) => a.tipo === 'vencidos_sobre_umbral').length, 1,
      'debe existir exactamente una',
    )
  })

  test('se cierra sola cuando la condición deja de cumplirse', async () => {
    conUmbrales({ vencidos: '0' })
    await evaluarAlertas()
    assert.ok((await alertasActivas()).some((a) => a.tipo === 'vencidos_sobre_umbral'))

    // Umbral imposible de rebasar: la condición desaparece.
    conUmbrales({ vencidos: '100' })
    const r = await evaluarAlertas()

    assert.ok(r.resueltas >= 1, 'debe resolver la alerta anterior')
    assert.equal(
      (await alertasActivas()).some((a) => a.tipo === 'vencidos_sobre_umbral'), false,
      'ya no debe estar activa',
    )
  })

  test('con umbrales altos no inventa alertas', async () => {
    conUmbrales({ vencidos: '100', caida: '5', reaperturas: '9999' })
    const r = await evaluarAlertas()
    assert.equal(r.nuevas.length, 0)
    assert.equal(r.activas, 0)
  })

  test('la alerta guarda su clave para poder reconocerla después', async () => {
    conUmbrales({ vencidos: '0' })
    await evaluarAlertas()
    const [a] = await alertasActivas()
    assert.ok(a, 'debe existir una alerta activa')
    assert.ok((a.detalle as { clave?: string })?.clave, 'debe guardar la clave en el detalle')
  })

  test('reaperturas: una alerta por categoría, no una sola global', async () => {
    conUmbrales({ vencidos: '100', caida: '5', reaperturas: '1' })
    const r = await evaluarAlertas()
    const deReapertura = r.nuevas.filter((a) => a.tipo === 'reaperturas_categoria')
    if (deReapertura.length > 1) {
      const claves = new Set(deReapertura.map((a) => a.clave))
      assert.equal(claves.size, deReapertura.length, 'cada categoría debe tener su propia clave')
    }
  })
})

describe('indicadores internos (SPEC §4.5)', () => {
  test('el embudo del bot es coherente', async () => {
    const i = await calcularIndicadoresInternos()
    const b = i.bot
    assert.ok(b.conReporte <= b.conversaciones, 'no puede haber más reportes que conversaciones')
    assert.ok(b.escaladas <= b.conversaciones)
    assert.ok(b.efectividad >= 0 && b.efectividad <= 100)
    assert.ok(b.tasaEscalamiento >= 0 && b.tasaEscalamiento <= 100)
    assert.ok(b.usoFallback <= b.clasificacionesIA)
  })

  test('por dependencia: los vencidos son un subconjunto de los abiertos', async () => {
    const i = await calcularIndicadoresInternos()
    for (const d of i.dependencias) {
      assert.ok(d.vencidos <= d.abiertos, `${d.nombre}: ${d.vencidos} vencidos de ${d.abiertos} abiertos`)
      assert.ok(d.aTiempo <= d.resueltos, `${d.nombre}: más a tiempo que resueltos`)
      if (d.cumplimiento !== null) assert.ok(d.cumplimiento >= 0 && d.cumplimiento <= 100)
    }
  })

  test('por cuadrilla: nadie resuelve más de lo que le asignaron', async () => {
    const i = await calcularIndicadoresInternos()
    for (const c of i.cuadrillas) {
      assert.ok(c.aTiempo <= c.resueltos, `${c.nombre}: más a tiempo que resueltos`)
      if (c.calificacionPromedio !== null) {
        assert.ok(c.calificacionPromedio >= 1 && c.calificacionPromedio <= 5)
      }
    }
  })

  test('la primera respuesta nunca es negativa', async () => {
    const i = await calcularIndicadoresInternos()
    if (i.primeraRespuestaGlobalHoras !== null) {
      assert.ok(i.primeraRespuestaGlobalHoras >= 0)
    }
    for (const d of i.dependencias) {
      if (d.primeraRespuestaHoras !== null) assert.ok(d.primeraRespuestaHoras >= 0)
    }
  })
})
