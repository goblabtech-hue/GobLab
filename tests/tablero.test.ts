import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { calcularIndicadores, type Indicadores } from '../src/lib/indicadores'
import { generarDataset, DICCIONARIO } from '../src/lib/datos-abiertos'
import { aCsv } from '../src/components/tablero/csv'

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

describe('datos abiertos (SPEC §4.4g)', () => {
  test('publica exactamente las columnas del diccionario', async () => {
    const filas = await generarDataset()
    assert.ok(filas.length > 0)
    assert.deepEqual(
      Object.keys(filas[0]).sort(),
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
    const campos = Object.keys(filas[0]).map((c) => c.toLowerCase())
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
    assert.ok(csv.split('\r\n')[0].endsWith('a,b'))
  })

  test('un conjunto vacío no revienta', () => {
    assert.equal(aCsv([]), '')
  })
})
