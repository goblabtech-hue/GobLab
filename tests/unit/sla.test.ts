import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calcularFechaLimite, diasHabilesEntre, semaforo, aCivil, claveCivil, esDiaHabil, aInstante } from '../../src/domain/dias-habiles'

/**
 * Calendario de referencia (2026, America/Mexico_City):
 *   dom 6 sep · lun 7 · vie 11 · dom 13 · lun 14 · mié 16 (festivo) · vie 18 · lun 21
 */

const SIN_FESTIVOS = new Set<string>()
const CON_INDEPENDENCIA = new Set(['2026-09-16'])

/** Instante a una hora de pared concreta en la zona del municipio. */
const local = (y: number, m: number, d: number, h = 12, mi = 0) =>
  aInstante({ y, m, d }, { h, mi })

const dia = (f: Date) => claveCivil(aCivil(f))

describe('calcularFechaLimite', () => {
  test('salta sábados y domingos', () => {
    // lun 7 + 5 hábiles = 8, 9, 10, 11, lun 14
    const limite = calcularFechaLimite(local(2026, 9, 7, 10), 5, SIN_FESTIVOS)
    assert.equal(dia(limite), '2026-09-14')
  })

  test('salta también los días festivos', () => {
    // lun 7 + 8 hábiles, sin festivos: 8,9,10,11,14,15,16,17 -> jue 17
    assert.equal(dia(calcularFechaLimite(local(2026, 9, 7, 10), 8, SIN_FESTIVOS)), '2026-09-17')
    // con el 16 festivo se recorre un día: 8,9,10,11,14,15,17,18 -> vie 18
    assert.equal(dia(calcularFechaLimite(local(2026, 9, 7, 10), 8, CON_INDEPENDENCIA)), '2026-09-18')
  })

  test('cuenta en hora local, no en UTC (corrección C-09)', () => {
    // domingo 19:00 en el centro de México ya es lunes 01:00 UTC.
    // Contando en local: siguiente hábil = lunes 14.
    // Contando en UTC arrancaría el lunes y daría martes 15.
    const creado = local(2026, 9, 13, 19)
    assert.equal(creado.toISOString().slice(0, 10), '2026-09-14', 'el instante sí cae en lunes UTC')
    assert.equal(dia(calcularFechaLimite(creado, 1, SIN_FESTIVOS)), '2026-09-14')
  })

  test('un reporte de viernes por la noche vence el lunes, no el sábado', () => {
    assert.equal(dia(calcularFechaLimite(local(2026, 9, 11, 23, 30), 1, SIN_FESTIVOS)), '2026-09-14')
  })

  test('la fecha límite es el final del día en hora local', () => {
    const limite = calcularFechaLimite(local(2026, 9, 7, 10), 5, SIN_FESTIVOS)
    const hora = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(limite)
    assert.equal(hora, '23:59')
  })

  test('un SLA de 0 o negativo se trata como 1 día hábil, no como "ya vencido"', () => {
    assert.equal(dia(calcularFechaLimite(local(2026, 9, 7, 10), 0, SIN_FESTIVOS)), '2026-09-08')
  })
})

describe('diasHabilesEntre', () => {
  test('el mismo día son 0 días', () => {
    assert.equal(diasHabilesEntre(local(2026, 9, 7, 9), local(2026, 9, 7, 18), SIN_FESTIVOS), 0)
  })

  test('de lunes a viernes son 4', () => {
    assert.equal(diasHabilesEntre(local(2026, 9, 7), local(2026, 9, 11), SIN_FESTIVOS), 4)
  })

  test('el fin de semana no cuenta', () => {
    assert.equal(diasHabilesEntre(local(2026, 9, 11), local(2026, 9, 14), SIN_FESTIVOS), 1)
  })

  test('el festivo tampoco cuenta', () => {
    // lun 14 -> vie 18: 15, 16, 17, 18 = 4; con el 16 festivo = 3
    assert.equal(diasHabilesEntre(local(2026, 9, 14), local(2026, 9, 18), SIN_FESTIVOS), 4)
    assert.equal(diasHabilesEntre(local(2026, 9, 14), local(2026, 9, 18), CON_INDEPENDENCIA), 3)
  })

  test('si la fecha final es anterior a la inicial devuelve 0, no un negativo', () => {
    assert.equal(diasHabilesEntre(local(2026, 9, 18), local(2026, 9, 14), SIN_FESTIVOS), 0)
  })
})

describe('esDiaHabil', () => {
  test('distingue fin de semana, festivo y día normal', () => {
    assert.equal(esDiaHabil({ y: 2026, m: 9, d: 7 }, SIN_FESTIVOS), true)   // lunes
    assert.equal(esDiaHabil({ y: 2026, m: 9, d: 13 }, SIN_FESTIVOS), false) // domingo
    assert.equal(esDiaHabil({ y: 2026, m: 9, d: 16 }, CON_INDEPENDENCIA), false)
  })
})

describe('semaforo', () => {
  const ahora = local(2026, 9, 7, 10) // lunes

  test('rojo cuando ya venció', () => {
    assert.equal(semaforo(local(2026, 9, 4, 23), SIN_FESTIVOS, ahora), 'rojo')
  })

  test('ámbar cuando queda un día hábil o menos', () => {
    assert.equal(semaforo(local(2026, 9, 8, 23), SIN_FESTIVOS, ahora), 'ambar')
  })

  test('verde cuando todavía hay margen', () => {
    assert.equal(semaforo(local(2026, 9, 18, 23), SIN_FESTIVOS, ahora), 'verde')
  })

  test('el viernes por la tarde con vencimiento el lunes es ámbar, no verde', () => {
    const viernes = local(2026, 9, 11, 16)
    assert.equal(semaforo(local(2026, 9, 14, 23), SIN_FESTIVOS, viernes), 'ambar')
  })
})
