import 'dotenv/config'
import { test, describe, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { procesarMensaje } from '../../src/application/bot/bot'
import { hashTelefono } from '../../src/domain/telefono'
import { pareceEmergencia } from '../../src/application/bot/clasificador'
import { TelegramProvider, aHtmlTelegram } from '../../src/infrastructure/mensajeria/telegram'
import { WhatsAppCloudProvider } from '../../src/infrastructure/mensajeria/whatsapp-cloud'

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
function uno<T>(xs: readonly T[], que = 'elemento'): T {
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

describe('elegir colonia entre 143 asentamientos', () => {
  /**
   * Al cargar los asentamientos reales de Tula la lista pasó de 24 a 143.
   * Paginada de ocho en ocho son dieciocho páginas: la pantalla que antes
   * funcionaba dejó de servir, y el ciudadano tiene que poder escribir el
   * nombre.
   */
  async function llegarAColonia(marca: string) {
    await di('hola'); await di('1')
    await di(`bache grande, prueba de colonias ${marca}`)
    await di('1')        // categoría
    await di('seguir')   // sin foto
    // Una dirección que no menciona ninguna colonia: cae a elegir de la lista.
    return di('por la calle de enfrente, junto al portón azul')
  }

  test('la lista invita a escribir el nombre en vez de paginar', async () => {
    const salida = await llegarAColonia(`a${Date.now()}`)
    assert.ok(dice(salida, 'scríbeme cómo se llama'), `esperaba la invitación en: ${uno(salida).texto}`)
  })

  test('escribir el nombre la encuentra sin pasar por la lista', async () => {
    await llegarAColonia(`b${Date.now()}`)
    const salida = await di('Xochitlán de las Flores')
    assert.ok(
      dice(salida, 'Voy a registrar esto') || dice(salida, 'mismo problema'),
      `debió avanzar; dijo: ${uno(salida).texto}`,
    )
  })

  test('sin acentos y en minúsculas también', async () => {
    await llegarAColonia(`c${Date.now()}`)
    const salida = await di('xochitlan de las flores')
    assert.ok(dice(salida, 'Voy a registrar esto') || dice(salida, 'mismo problema'))
  })

  test('un nombre que existe en dos lugares pregunta cuál, con su código postal', async () => {
    await llegarAColonia(`d${Date.now()}`)
    const salida = await di('Bugambilias')
    const texto = uno(salida).texto
    assert.ok(texto.includes('varias'), `debió preguntar: ${texto}`)
    assert.ok(texto.includes('42833') && texto.includes('42803'),
      `debió distinguirlas por código postal: ${texto}`)
  })

  test('tras preguntar, el número se refiere a lo que acaba de mostrar', async () => {
    await llegarAColonia(`e${Date.now()}`)
    await di('Bugambilias')
    const salida = await di('2')
    assert.ok(
      dice(salida, 'Voy a registrar esto') || dice(salida, 'mismo problema'),
      `debió tomar la segunda opción mostrada; dijo: ${uno(salida).texto}`,
    )
  })

  test('un nombre inexistente lo dice, no lo inventa', async () => {
    await llegarAColonia(`f${Date.now()}`)
    const salida = await di('Colonia Que No Existe')
    assert.ok(dice(salida, 'No encontré'), uno(salida).texto)
  })
})

describe('el canal queda registrado como lo que es', () => {
  const CHAT_TG = '881234567'
  let m = 0
  const enTelegram = (texto: string, extra: Record<string, unknown> = {}) =>
    procesarMensaje({
      canal: 'telegram', chatId: CHAT_TG, idExterno: `tg${Date.now()}-${++m}`,
      texto, nombre: 'Laura', ...extra,
    })

  after(async () => {
    await prisma.conversacionBot.deleteMany({
      where: { canal: 'telegram', chatIdHash: hashTelefono(CHAT_TG) },
    })
  })

  /**
   * Esta prueba nace de un error real: el alta fijaba `origen: 'telegram'` y
   * un `update` posterior lo sobrescribía con `'whatsapp'` en las dos ramas de
   * un ternario. Las demás pruebas del bot corren por el simulador, donde el
   * valor correcto ES 'whatsapp', así que ninguna lo notó. La consecuencia no
   * era cosmética: la gráfica de canales del tablero público habría dicho que
   * nadie usa Telegram, y el municipio habría decidido dónde invertir con un
   * dato falso.
   */
  test('un reporte levantado por Telegram no se cuenta como WhatsApp', async () => {
    const marca = `bache en la calle, prueba de canal telegram ${Date.now()}`
    await enTelegram('/start')
    await enTelegram(marca)
    await enTelegram('1')
    await enTelegram('seguir')

    // La oferta de adherirse llega como respuesta a la UBICACIÓN, no al «sí».
    // Si se contesta «sí» ahí, el ciudadano se suma a un reporte ajeno y no se
    // crea nada: la prueba leería el folio de otro y pasaría sin probar nada.
    let salida = await enTelegram('', { ubicacion: { lat: 20.0533, lng: -99.3421 } })
    if (salida.some((r) => r.texto.includes('¿Es el mismo problema?'))) {
      salida = await enTelegram('no')
    }
    assert.ok(
      salida.some((r) => r.texto.includes('Voy a registrar esto')),
      'debe estar pidiendo la confirmación final',
    )

    salida = await enTelegram('si')

    // Se busca por la descripción, no por el folio del mensaje: así se
    // garantiza que lo que se revisa es el reporte que ESTA prueba levantó.
    const r = await prisma.reporte.findFirstOrThrow({
      where: { descripcion: marca },
      select: { folio: true, origen: true, canalNotificacion: true, telefonoHash: true },
    })
    creados.push(r.folio)

    assert.ok(salida.some((m) => m.texto.includes(r.folio)), 'debe darle su folio al ciudadano')
    assert.equal(r.origen, 'telegram', 'el origen debe ser el canal real, no whatsapp')
    assert.equal(r.canalNotificacion, 'telegram', 'hay que responderle por donde escribió')
    assert.equal(
      r.telefonoHash, null,
      'en Telegram el chat id no es un teléfono y no debe guardarse como tal',
    )
  })
})

describe('formato de los mensajes en Telegram', () => {
  /**
   * Ambos casos salieron de la primera conversación real: el ciudadano vio
   * «Tu folio es *TUL-2026-00346*» con los asteriscos a la vista, porque el
   * motor escribe negritas al estilo WhatsApp y Telegram no interpreta nada
   * sin `parse_mode`.
   */
  test('las negritas del motor se vuelven negritas de verdad', () => {
    assert.equal(
      aHtmlTelegram('Tu folio es *TUL-2026-00346*'),
      'Tu folio es <b>TUL-2026-00346</b>',
    )
    assert.equal(aHtmlTelegram('escribe *seguir*'), 'escribe <b>seguir</b>')
  })

  test('lo que escribe el ciudadano no puede romper el envío ni colarse como etiqueta', () => {
    // Telegram rechaza el mensaje ENTERO con 400 si el marcado no cuadra, y
    // la descripción del ciudadano viaja dentro de la confirmación. Con HTML
    // se escapa antes de aplicar negritas, así que nada de esto revienta.
    assert.equal(
      aHtmlTelegram('hay un <script>alert(1)</script> en la calle'),
      'hay un &lt;script&gt;alert(1)&lt;/script&gt; en la calle',
    )
    assert.equal(aHtmlTelegram('Pérez & Hnos'), 'Pérez &amp; Hnos')
    // Un asterisco suelto no debe producir etiquetas a medias.
    assert.equal(aHtmlTelegram('cuesta 5*'), 'cuesta 5*')
    assert.equal(aHtmlTelegram('guion_bajo_suelto'), 'guion_bajo_suelto')
  })
})

describe('la confirmación no puede ocultar dónde se va a archivar', () => {
  const CHAT_C = '5590000009'
  let m = 0
  const diC = (texto: string, extra: Record<string, unknown> = {}) =>
    procesarMensaje({ canal: 'simulador', chatId: CHAT_C, idExterno: `cf${Date.now()}-${++m}`, texto, ...extra })

  after(async () => {
    await prisma.conversacionBot.deleteMany({
      where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT_C) },
    })
  })

  /**
   * De la primera conversación real: alguien escribió «calle Tulipanes,
   * colonia Obrera», eligió otra colonia de la lista porque la suya no está en
   * el catálogo, y la confirmación le enseñó solo su texto. Aprobó una
   * pantalla que nunca le dijo bajo qué colonia se iba a registrar — y la
   * cuadrilla sale a donde diga la colonia.
   */
  test('enseña la dirección escrita Y la colonia elegida', async () => {
    const marca = `bache, prueba de confirmacion ${Date.now()}`
    await diC('hola'); await diC('1')
    await diC(marca)
    await diC('1'); await diC('seguir')
    await diC('calle Tulipanes, colonia Obrera')   // no existe: pide elegir
    const salida = await diC('Acoculco')

    const confirmacion = salida.find((r) => r.texto.includes('Voy a registrar esto'))
      ?? uno(await diC('1'), 'confirmación')
    assert.ok(confirmacion.texto.includes('Tulipanes'), `falta la dirección: ${confirmacion.texto}`)
    assert.ok(confirmacion.texto.includes('Acoculco'), `falta la colonia: ${confirmacion.texto}`)
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
