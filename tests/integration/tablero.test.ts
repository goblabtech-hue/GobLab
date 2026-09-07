import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { calcularIndicadores, type Indicadores } from '../../src/application/indicadores'
import { aCsv } from '../../src/components/tablero/csv'

let ind: Indicadores

before(async () => { ind = await calcularIndicadores() })
after(async () => { await prisma.$disconnect() })

describe('KPIs del tablero (SPEC §6)', () => {
  test('el cumplimiento es la proporción de resueltos dentro del plazo', async () => {
    const aTiempo = ind.promesas.reduce((s, p) => s + p.aTiempo, 0)
    const resueltos = ind.promesas.reduce((s, p) => s + p.resueltos, 0)
    assert.equal(resueltos, ind.resumen.resueltos.valor, 'las promesas deben cubrir todos los resueltos')
    assert.ok(
      Math.abs(ind.resumen.cumplimiento.valor - (aTiempo / resueltos) * 100) < 0.01,
      'el porcentaje del resumen debe cuadrar con la suma por categoría',
    )
  })

  test('la tasa de vencidos se mide sobre los abiertos, no sobre el total', () => {
    const esperado = ind.abiertos ? (ind.vencidosAhora / ind.abiertos) * 100 : 0
    assert.ok(Math.abs(ind.tasas.vencidos - esperado) < 0.001)
    assert.ok(ind.vencidosAhora <= ind.abiertos, 'no puede haber más vencidos que abiertos')
  })

  test('todos los porcentajes caen entre 0 y 100', () => {
    const pcts = [
      ind.resumen.cumplimiento.valor,
      ind.tasas.vencidos, ind.tasas.reasignacion, ind.tasas.reapertura,
      ...ind.promesas.map((p) => p.cumplimiento).filter((x): x is number => x !== null),
    ]
    for (const p of pcts) assert.ok(p >= 0 && p <= 100, `porcentaje fuera de rango: ${p}`)
  })

  test('la calificación promedio cae entre 1 y 5', () => {
    const c = ind.resumen.calificacion.valor
    assert.ok(c === 0 || (c >= 1 && c <= 5), `calificación fuera de rango: ${c}`)
  })

  test('cada KPI trae su comparación contra el periodo anterior (SPEC §6.8)', () => {
    for (const [nombre, c] of Object.entries(ind.resumen)) {
      assert.ok(typeof c.anterior === 'number', `${nombre} debe traer el valor anterior`)
      assert.ok(c.anterior > 0, `${nombre}: el seed debe sembrar el periodo anterior para poder comparar`)
    }
  })

  test('las series mensuales cubren el periodo completo sin huecos', () => {
    assert.ok(ind.evolucionMensual.length >= 12)
    const claves = ind.evolucionMensual.map((m) => m.mes)
    assert.deepEqual(claves, [...claves].sort(), 'los meses deben venir en orden')
    assert.equal(new Set(claves).size, claves.length, 'no debe haber meses repetidos')
    for (const serie of [ind.puntualidadMensual, ind.reasignadosMensual]) {
      assert.deepEqual(serie.map((m) => m.mes), claves, 'todas las series comparten los mismos meses')
    }
  })

  test('la puntualidad mensual suma exactamente los resueltos del periodo', () => {
    const suma = ind.puntualidadMensual.reduce((s, m) => s + m.aTiempo + m.tarde, 0)
    assert.equal(suma, ind.resumen.resueltos.valor)
  })

  test('la distribución de calificaciones trae las cinco barras', () => {
    assert.deepEqual(ind.calificaciones.map((c) => c.estrellas), [1, 2, 3, 4, 5])
  })

  test('el tiempo promedio real es coherente con el plazo prometido', () => {
    // Si una categoría cumple 100%, su promedio no puede exceder el plazo.
    for (const p of ind.promesas) {
      if (p.cumplimiento === 100 && p.diasPromedio !== null) {
        assert.ok(
          p.diasPromedio <= p.slaDiasHabiles,
          `${p.nombre}: cumple 100% pero tarda ${p.diasPromedio} contra un plazo de ${p.slaDiasHabiles}`,
        )
      }
    }
  })
})

describe('exportación CSV de las gráficas', () => {
  test('escapa comas, comillas y saltos de línea', () => {
    const csv = aCsv([{ a: 'con, coma', b: 'con "comillas"', c: 'con\nsalto' }])
    assert.ok(csv.includes('"con, coma"'))
    assert.ok(csv.includes('"con ""comillas"""'))
    assert.ok(csv.includes('"con\nsalto"'))
  })

  test('lleva BOM para que Excel no destroce los acentos', () => {
    assert.ok(aCsv([{ a: 'á' }]).startsWith('﻿'))
  })

  test('respeta el orden de columnas que se le pida', () => {
    const csv = aCsv([{ b: 2, a: 1 }], ['a', 'b'])
    const encabezado = csv.split('\r\n')[0] ?? ''
    assert.ok(encabezado.endsWith('a,b'))
  })

  test('un conjunto vacío no revienta', () => {
    assert.equal(aCsv([]), '')
  })
})
