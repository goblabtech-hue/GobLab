import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { distanciaMetros, prioridadPorAdhesiones } from '../src/lib/duplicados'

describe('distanciaMetros', () => {
  test('el mismo punto está a 0 m', () => {
    assert.equal(distanciaMetros(19.4326, -99.1332, 19.4326, -99.1332), 0)
  })

  test('un grado de latitud son ~111 km', () => {
    const d = distanciaMetros(19.4326, -99.1332, 20.4326, -99.1332)
    assert.ok(Math.abs(d - 111_195) < 500, `esperaba ~111 km, dio ${Math.round(d)} m`)
  })

  test('0.001° de latitud son ~111 m', () => {
    const d = distanciaMetros(19.4326, -99.1332, 19.4336, -99.1332)
    assert.ok(Math.abs(d - 111) < 2, `esperaba ~111 m, dio ${d.toFixed(1)} m`)
  })

  test('la longitud se acorta con la latitud', () => {
    // a 19° de latitud, un grado de longitud mide menos que uno de latitud
    const lat = distanciaMetros(19.4326, -99.1332, 20.4326, -99.1332)
    const lng = distanciaMetros(19.4326, -99.1332, 19.4326, -98.1332)
    assert.ok(lng < lat, 'un grado de longitud debe ser más corto que uno de latitud')
    assert.ok(Math.abs(lng - lat * Math.cos((19.4326 * Math.PI) / 180)) < 500)
  })

  test('es simétrica', () => {
    const a = distanciaMetros(19.43, -99.13, 19.44, -99.14)
    const b = distanciaMetros(19.44, -99.14, 19.43, -99.13)
    assert.ok(Math.abs(a - b) < 1e-6)
  })

  test('la esquina de la caja de ±100 m queda fuera del radio de 100 m', () => {
    // El prefiltro SQL usa una caja; Haversine es el filtro exacto. Una
    // esquina de la caja está a ~141 m y NO debe contar como duplicado.
    const gradosLat = 100 / 111_320
    const gradosLng = 100 / (111_320 * Math.cos((19.4326 * Math.PI) / 180))
    const esquina = distanciaMetros(19.4326, -99.1332, 19.4326 + gradosLat, -99.1332 + gradosLng)
    assert.ok(esquina > 100, `la esquina debe exceder 100 m, dio ${esquina.toFixed(1)} m`)
    assert.ok(esquina < 145)
  })
})

describe('prioridadPorAdhesiones', () => {
  test('escala con el número de vecinos que se suman', () => {
    assert.equal(prioridadPorAdhesiones(0), 'normal')
    assert.equal(prioridadPorAdhesiones(2), 'normal')
    assert.equal(prioridadPorAdhesiones(3), 'alta')
    assert.equal(prioridadPorAdhesiones(9), 'alta')
    assert.equal(prioridadPorAdhesiones(10), 'urgente')
  })
})
