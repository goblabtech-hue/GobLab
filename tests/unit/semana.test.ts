import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  semanaDe, semanaDeClave, semanaAnterior, semanaSiguiente,
  ultimasSemanas, etiquetaSemana, enCurso,
} from '../../src/domain/semana'
import { aCivil, claveCivil } from '../../src/domain/dias-habiles'

/**
 * La semana del municipio corre de lunes a domingo en horario de México. Las
 * pruebas se concentran en los bordes, que es donde un informe empieza a
 * mentir sin que nadie lo note.
 */

describe('límites de la semana', () => {
  test('empieza en lunes', () => {
    // Miércoles 9 de septiembre de 2026.
    const s = semanaDe(new Date('2026-09-09T15:00:00Z'))
    assert.equal(s.clave, '2026-09-07', 'el lunes de esa semana')
    assert.equal(claveCivil(aCivil(s.inicio)), '2026-09-07')
  })

  test('el lunes mismo pertenece a su propia semana, no a la anterior', () => {
    // Lunes 7 a las 00:30 de México = 06:30 UTC.
    assert.equal(semanaDe(new Date('2026-09-07T06:30:00Z')).clave, '2026-09-07')
  })

  test('el domingo pertenece a la semana que termina', () => {
    // Domingo 13 a las 23:00 de México.
    assert.equal(semanaDe(new Date('2026-09-14T05:00:00Z')).clave, '2026-09-07')
  })

  /**
   * Este es el error que justifica todo el módulo. México va seis horas detrás
   * de UTC: un reporte resuelto el domingo a las 18:30 ya es lunes en UTC. Si
   * el corte se calculara en UTC, ese trabajo aparecería en la semana
   * siguiente y el informe no cuadraría con lo que la cuadrilla recuerda.
   */
  test('lo resuelto el domingo por la tarde NO se va a la semana siguiente', () => {
    const domingoTarde = new Date('2026-09-14T00:30:00Z') // dom 13, 18:30 en México
    assert.equal(new Date(domingoTarde).getUTCDay(), 1, 'en UTC ya es lunes')
    assert.equal(semanaDe(domingoTarde).clave, '2026-09-07', 'pero cuenta en la semana que cerró')
  })

  test('el fin es exclusivo: cae justo en el inicio de la siguiente', () => {
    const s = semanaDe(new Date('2026-09-09T15:00:00Z'))
    assert.equal(s.fin.getTime(), semanaSiguiente(s).inicio.getTime())
  })

  test('dura exactamente siete días', () => {
    const s = semanaDe(new Date('2026-09-09T15:00:00Z'))
    assert.equal((s.fin.getTime() - s.inicio.getTime()) / 86_400_000, 7)
  })
})

describe('navegación', () => {
  test('anterior y siguiente son inversas', () => {
    const s = semanaDe(new Date('2026-09-09T15:00:00Z'))
    assert.equal(semanaSiguiente(semanaAnterior(s)).clave, s.clave)
  })

  test('cruza el cambio de mes sin saltarse semanas', () => {
    const s = semanaDe(new Date('2026-09-02T15:00:00Z')) // mié 2 de septiembre
    assert.equal(s.clave, '2026-08-31', 'esa semana empieza en agosto')
    assert.equal(semanaAnterior(s).clave, '2026-08-24')
  })

  test('cruza el cambio de año', () => {
    const s = semanaDe(new Date('2027-01-01T15:00:00Z')) // viernes 1 de enero
    assert.equal(s.clave, '2026-12-28')
  })

  test('ultimasSemanas devuelve n consecutivas, de la más reciente hacia atrás', () => {
    const ss = ultimasSemanas(4, new Date('2026-09-09T15:00:00Z'))
    assert.deepEqual(ss.map((s) => s.clave), ['2026-09-07', '2026-08-31', '2026-08-24', '2026-08-17'])
  })
})

describe('clave de la URL', () => {
  test('ida y vuelta', () => {
    const s = semanaDe(new Date('2026-09-09T15:00:00Z'))
    assert.equal(semanaDeClave(s.clave)?.clave, s.clave)
  })

  test('una clave a media semana se normaliza al lunes', () => {
    // Alguien edita la URL a un jueves: debe ver la semana de ese jueves,
    // no un rango de siete días desalineado del resto de los informes.
    assert.equal(semanaDeClave('2026-09-10')?.clave, '2026-09-07')
  })

  test('una clave inválida no revienta', () => {
    for (const mala of ['', 'ayer', '2026-9-7', '2026-09-07T00:00:00Z', '../../etc']) {
      assert.equal(semanaDeClave(mala), null, `debió rechazar «${mala}»`)
    }
  })
})

describe('presentación', () => {
  test('semana dentro de un mes', () => {
    assert.equal(
      etiquetaSemana(semanaDe(new Date('2026-09-09T15:00:00Z'))),
      'del 7 al 13 de septiembre de 2026',
    )
  })

  test('semana a caballo entre dos meses', () => {
    assert.equal(
      etiquetaSemana(semanaDe(new Date('2026-09-02T15:00:00Z'))),
      'del 31 de agosto al 6 de septiembre de 2026',
    )
  })

  test('semana a caballo entre dos años', () => {
    assert.equal(
      etiquetaSemana(semanaDe(new Date('2027-01-01T15:00:00Z'))),
      'del 28 de diciembre de 2026 al 3 de enero de 2027',
    )
  })

  test('la etiqueta termina en domingo, no en el lunes siguiente', () => {
    assert.ok(etiquetaSemana(semanaDe(new Date('2026-09-09T15:00:00Z'))).includes('al 13'))
  })
})

describe('semana en curso', () => {
  test('la semana actual está en curso: el informe va incompleto', () => {
    const ahora = new Date('2026-09-09T15:00:00Z')
    assert.equal(enCurso(semanaDe(ahora), ahora), true)
  })

  test('una semana pasada ya cerró', () => {
    const ahora = new Date('2026-09-09T15:00:00Z')
    assert.equal(enCurso(semanaAnterior(semanaDe(ahora)), ahora), false)
  })
})
