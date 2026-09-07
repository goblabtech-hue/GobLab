import 'dotenv/config'
import { test, describe, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { procesarMensaje } from '../src/lib/ia/bot'
import { hashTelefono } from '../src/lib/telefono'
import { pareceEmergencia } from '../src/lib/ia/clasificador'
import { TelegramProvider } from '../src/lib/mensajeria/telegram'
import { WhatsAppCloudProvider } from '../src/lib/mensajeria/whatsapp-cloud'

/**
 * El bot se prueba por el simulador, que atraviesa exactamente el mismo motor
 * que WhatsApp y Telegram. Sin ANTHROPIC_API_KEY estas pruebas ejercen el
 * camino de respaldo por menú, que es justo el que el SPEC exige que funcione
 * sin llave.
 */

const CHAT = '5590000001'
const creados: string[] = []
let n = 0

async function di(texto: string, extra: Record<string, unknown> = {}) {
  return procesarMensaje({
    canal: 'simulador', chatId: CHAT, idExterno: `p${++n}`, texto, nombre: 'Prueba', ...extra,
  })
}

/** Primer elemento de un arreglo que la prueba espera no vacío. */
function uno<T>(xs: T[], que = 'elemento'): T {
  const x = xs[0]
  if (x === undefined) throw new Error(`Se esperaba un ${que} y el arreglo vino vacío.`)
  return x
}

const dice = (salida: { texto: string }[], fragmento: string) =>
  salida.some((m) => m.texto.toLowerCase().includes(fragmento.toLowerCase()))

beforeEach(async () => {
  n = Math.floor(Math.random() * 1e6)
  await prisma.conversacionBot.deleteMany({
    where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
  })
})

after(async () => {
  if (creados.length) await prisma.reporte.deleteMany({ where: { folio: { in: creados } } })
  await prisma.conversacionBot.deleteMany({
    where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
  })
  await prisma.$disconnect()
})

describe('emergencias', () => {
  test('reconoce las palabras de riesgo', () => {
    assert.ok(pareceEmergencia('huele a gas en toda la cuadra'))
    assert.ok(pareceEmergencia('HAY UN INCENDIO'))
    assert.ok(pareceEmergencia('un cable de alta tensión se cayó'))
  })

  test('un bache o una fuga NO son emergencia', () => {
    assert.equal(pareceEmergencia('hay un bache enorme'), false)
    assert.equal(pareceEmergencia('se está saliendo el agua de la banqueta'), false)
  })

  test('el bot nunca intenta resolver una emergencia: escala y da el número', async () => {
    const salida = await di('hay un incendio en la casa de al lado')
    assert.ok(dice(salida, '911'), 'debe dar el número de emergencias')

    const conv = await prisma.conversacionBot.findFirstOrThrow({
      where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
    })
    assert.equal(conv.escaladaAHumano, true)
  })

  test('tras escalar deja de conducir el flujo', async () => {
    await di('se escucha una explosión')
    const salida = await di('1')
    assert.ok(dice(salida, 'una persona'), 'debe seguir en modo humano, no volver al menú')
  })
})

describe('menú', () => {
  test('saluda y ofrece las cuatro opciones del SPEC', async () => {
    const salida = await di('hola')
    for (const opcion of ['Reportar', 'folio', 'Información', 'persona']) {
      assert.ok(dice(salida, opcion), `falta la opción: ${opcion}`)
    }
  })

  test('"menú" regresa al inicio desde cualquier paso', async () => {
    await di('hola'); await di('1')
    const salida = await di('menu')
    assert.ok(dice(salida, 'Reportar un problema'))
  })

  test('pedir una persona escala sin más trámite', async () => {
    await di('hola')
    await di('quiero hablar con una persona')
    const conv = await prisma.conversacionBot.findFirstOrThrow({
      where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
    })
    assert.equal(conv.escaladaAHumano, true)
  })
})

describe('alta de reporte por el bot', () => {
  test('el flujo completo genera folio y promete un plazo', async () => {
    await di('hola'); await di('1')
    await di('hay un bache muy grande frente a la escuela de la colonia')
    await di('1')            // categoría del menú de respaldo
    await di('seguir')       // sin foto
    await di('', { ubicacion: { lat: 19.4401, lng: -99.1501 } })
    const salida = await di('si')

    const folio = salida[0]?.texto.match(/[A-Z]{2,5}-\d{4}-\d{5,}/)?.[0]
    assert.ok(folio, `esperaba un folio en: ${salida[0]?.texto}`)
    creados.push(folio)

    assert.ok(dice(salida, 'días hábiles'), 'debe decir la promesa de servicio')

    const r = await prisma.reporte.findUniqueOrThrow({
      where: { folio },
      select: { estatus: true, lat: true, canalNotificacion: true, telefonoHash: true },
    })
    assert.equal(r.estatus, 'nuevo')
    assert.equal(r.lat, 19.4401)
    assert.ok(r.canalNotificacion, 'debe quedar registrado a dónde avisarle')
    assert.ok(r.telefonoHash, 'el simulador imita a WhatsApp: el chat id es el teléfono')
  })

  test('cancelar en la confirmación no crea nada', async () => {
    const marca = 'basura acumulada en la esquina, prueba de cancelación'
    await di('hola'); await di('1')
    await di(marca)
    await di('1'); await di('seguir')
    await di('', { ubicacion: { lat: 19.45, lng: -99.19 } })
    const salida = await di('no')

    assert.ok(dice(salida, 'no lo mandé'))
    // Se comprueba por la descripción y no por un conteo global: las suites
    // corren en paralelo contra la misma base y el total se mueve solo.
    const creado = await prisma.reporte.findFirst({ where: { descripcion: marca } })
    assert.equal(creado, null, 'no debe existir un reporte con esa descripción')
  })

  test('una descripción demasiado corta pide más detalle', async () => {
    await di('hola'); await di('1')
    const salida = await di('bache')
    assert.ok(dice(salida, 'más'), 'debe pedir más información')
  })

  test('reintentar el mismo id de mensaje no duplica el reporte', async () => {
    const marca = `árbol caído sobre la banqueta, prueba de reintento ${Date.now()}`
    await di('hola'); await di('1')
    await di(marca)
    await di('1'); await di('seguir')
    await di('', { ubicacion: { lat: 19.42, lng: -99.14 } })

    const idRepetido = `dup${Date.now()}`
    const primera = await procesarMensaje({ canal: 'simulador', chatId: CHAT, idExterno: idRepetido, texto: 'si' })
    const folio = primera[0]?.texto.match(/[A-Z]{2,5}-\d{4}-\d{5,}/)?.[0]
    assert.ok(folio, 'la primera vez sí debe crear el reporte')
    creados.push(folio)

    const segunda = await procesarMensaje({ canal: 'simulador', chatId: CHAT, idExterno: idRepetido, texto: 'si' })
    assert.equal(segunda.length, 0, 'un reintento no debe responder')

    // Se cuenta por la descripción y no sobre el total: las suites corren en
    // paralelo contra la misma base y el total se mueve solo.
    const cuantos = await prisma.reporte.count({ where: { descripcion: marca } })
    assert.equal(cuantos, 1, 'debe existir exactamente un reporte con esa descripción')
  })
})

describe('interpretación de los canales', () => {
  test('Telegram: texto, ubicación, contacto y foto', () => {
    const t = new TelegramProvider()

    const texto = uno(t.interpretar({ message: { message_id: 7, chat: { id: 42 }, text: 'hola', from: { first_name: 'Ana' } } }), 'mensaje')
    assert.deepEqual(
      { canal: texto.canal, chatId: texto.chatId, texto: texto.texto, nombre: texto.nombre },
      { canal: 'telegram', chatId: '42', texto: 'hola', nombre: 'Ana' },
    )

    const ubi = uno(t.interpretar({ message: { message_id: 8, chat: { id: 42 }, location: { latitude: 19.4, longitude: -99.1 } } }), 'mensaje')
    assert.deepEqual(ubi.ubicacion, { lat: 19.4, lng: -99.1 })

    const contacto = uno(t.interpretar({ message: { message_id: 9, chat: { id: 42 }, contact: { phone_number: '+525512345678' } } }), 'mensaje')
    assert.equal(contacto.telefonoCompartido, '+525512345678')

    // de varios tamaños, se toma el último, que es el de mayor resolución
    const foto = uno(t.interpretar({
      message: { message_id: 10, chat: { id: 42 }, photo: [{ file_id: 'chico' }, { file_id: 'grande' }] },
    }), 'mensaje')
    assert.equal(foto.mediaUrl, 'telegram-file:grande')
  })

  test('WhatsApp: el id del botón llega como texto para el motor', () => {
    const m = uno(new WhatsAppCloudProvider().interpretar({
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: 'Luis' } }],
        messages: [{ id: 'wamid.1', from: '5215512345678', type: 'interactive',
          interactive: { button_reply: { id: 'op_reportar' } } }],
      } }] }],
    }), 'mensaje')
    assert.equal(m.texto, 'op_reportar')
    assert.equal(m.chatId, '5215512345678')
    assert.equal(m.nombre, 'Luis')
  })

  test('WhatsApp: un webhook vacío no revienta', () => {
    assert.deepEqual(new WhatsAppCloudProvider().interpretar({}), [])
    assert.deepEqual(new WhatsAppCloudProvider().interpretar({ entry: [{}] }), [])
  })
})
