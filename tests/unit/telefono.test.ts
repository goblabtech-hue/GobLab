import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarTelefono, telefonoValido, hashTelefono, cifrarTelefono,
  descifrarTelefono, enmascararTelefono, derivarTelefono,
} from '../../src/domain/telefono'

describe('normalizarTelefono', () => {
  test('quita separadores y deja 10 dígitos', () => {
    assert.equal(normalizarTelefono('(55) 1234-5678'), '5512345678')
    assert.equal(normalizarTelefono('55 12 34 56 78'), '5512345678')
  })

  test('quita la lada de país en sus tres formas comunes', () => {
    assert.equal(normalizarTelefono('+52 55 1234 5678'), '5512345678')
    assert.equal(normalizarTelefono('+52 1 55 1234 5678'), '5512345678')
    assert.equal(normalizarTelefono('5215512345678'), '5512345678')
  })

  test('el mismo número escrito de seis formas produce un solo valor', () => {
    const formas = [
      '5512345678', '55 1234 5678', '(55) 1234-5678',
      '+52 55 1234 5678', '+52 1 55 1234 5678', '525512345678',
    ]
    const normalizados = new Set(formas.map(normalizarTelefono))
    assert.equal(normalizados.size, 1, 'debe colapsar a un único número')
  })

  test('telefonoValido exige exactamente 10 dígitos', () => {
    assert.equal(telefonoValido('5512345678'), true)
    assert.equal(telefonoValido('551234567'), false)
    assert.equal(telefonoValido('no es un teléfono'), false)
  })
})

describe('hashTelefono', () => {
  test('es determinista: el bot puede buscar por teléfono', () => {
    assert.equal(hashTelefono('5512345678'), hashTelefono('+52 1 55 1234 5678'))
  })

  test('números distintos dan hashes distintos', () => {
    assert.notEqual(hashTelefono('5512345678'), hashTelefono('5512345679'))
  })

  test('no contiene el número en claro', () => {
    assert.equal(hashTelefono('5512345678').includes('5512345678'), false)
  })
})

describe('cifrarTelefono / descifrarTelefono', () => {
  test('el ciclo completo devuelve el número normalizado', () => {
    assert.equal(descifrarTelefono(cifrarTelefono('+52 1 55 1234 5678')), '5512345678')
  })

  test('cifrar dos veces el mismo número da textos distintos', () => {
    // Es lo correcto en AES-GCM (nonce aleatorio) y justo la razón por la que
    // hace falta el hash aparte para poder buscar (corrección C-05).
    assert.notEqual(cifrarTelefono('5512345678'), cifrarTelefono('5512345678'))
  })

  test('un texto cifrado alterado no se descifra en silencio', () => {
    const cifrado = cifrarTelefono('5512345678')
    const [iv, tag] = cifrado.split('.')
    const alterado = [iv, tag, Buffer.from('9999999999').toString('base64')].join('.')
    assert.throws(() => descifrarTelefono(alterado))
  })

  test('un formato inválido lanza error claro', () => {
    assert.throws(() => descifrarTelefono('basura'), /formato inválido/)
  })
})

describe('enmascararTelefono', () => {
  test('usa el formato del SPEC: dos primeros, cuatro últimos', () => {
    assert.equal(enmascararTelefono('5512345678'), '55••••5678')
  })

  test('no deja ver los dígitos de en medio', () => {
    assert.equal(enmascararTelefono('5512345678').includes('1234'), false)
  })

  test('un número demasiado corto se oculta por completo', () => {
    assert.equal(enmascararTelefono('123'), '••••')
  })
})

describe('derivarTelefono', () => {
  test('entrega los tres derivados coherentes entre sí', () => {
    const d = derivarTelefono('+52 55 1234 5678')
    assert.equal(d.telefonoHash, hashTelefono('5512345678'))
    assert.equal(descifrarTelefono(d.telefonoCifrado), '5512345678')
    assert.equal(d.telefonoMascara, '55••••5678')
  })
})
