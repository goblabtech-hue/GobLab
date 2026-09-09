import 'dotenv/config'
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { procesarMensaje } from '../../src/application/bot/bot'
import { hashTelefono, cifrarTelefono } from '../../src/domain/telefono'
import {
  crearReporte, asignarCuadrilla, iniciarAtencion, resolverReporte,
} from '../../src/application/reportes'

/**
 * El ciclo que faltaba: seguirle la pista a un reporte ya levantado y decir si
 * el trabajo quedó bien.
 *
 * Antes el sistema avisaba «ya terminamos, califica del 1 al 5» y no había
 * nada escuchando esa respuesta: la persona contestaba al vacío y a los tres
 * días el reporte se autocerraba solo.
 */

const CHAT = '5591000001'
let categoriaId: number
let cuadrillaId: string
let supervisorId: string
const creados: string[] = []
let n = 0

const di = (texto: string, extra: Record<string, unknown> = {}) =>
  procesarMensaje({ canal: 'simulador', chatId: CHAT, idExterno: `sg${Date.now()}-${++n}`, texto, ...extra })

const dice = (salida: { texto: string }[], f: string) =>
  salida.some((m) => m.texto.toLowerCase().includes(f.toLowerCase()))

function uno<T>(xs: readonly T[], que = 'elemento'): T {
  const x = xs[0]
  if (x === undefined) throw new Error(`Se esperaba un ${que} y vino vacío.`)
  return x
}

/** Levanta un reporte por la vía interna y lo deja donde lo pida la prueba. */
async function reporteHasta(paso: 'abierto' | 'resuelto', marca: string) {
  const r = await crearReporte({
    categoriaId, descripcion: marca, origen: 'whatsapp',
    lat: 20.05, lng: -99.34, coloniaId: null, direccionTexto: null,
    telefono: CHAT, nombreContacto: 'Prueba', fotos: [],
  })
  creados.push(r.id)
  // Como lo deja el bot al levantarlo: por dónde avisarle a esta persona.
  // Sin esto el aviso saldría por «whatsapp» y no encontraría la conversación
  // del simulador, que es justo el pegamento que esta prueba verifica.
  await prisma.reporte.update({
    where: { id: r.id },
    data: { canalNotificacion: 'simulador', destinoNotificacion: cifrarTelefono(CHAT) },
  })
  if (paso === 'resuelto') {
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await iniciarAtencion(r.id, cuadrillaId)
    await resolverReporte({
      reporteId: r.id, userId: cuadrillaId,
      fotosEvidencia: ['/uploads/prueba/evidencia.jpg'],
      notaCierre: 'Se bacheó con mezcla asfáltica.',
    })
  }
  return r
}

before(async () => {
  const cat = await prisma.categoria.findFirstOrThrow({ where: { activa: true, requiereEvidencia: true } })
  categoriaId = cat.id
  cuadrillaId = (await prisma.usuario.findFirstOrThrow({ where: { rol: 'cuadrilla' } })).id
  supervisorId = (await prisma.usuario.findFirstOrThrow({ where: { rol: 'supervisor' } })).id
})

beforeEach(async () => {
  n = Math.floor(Math.random() * 1e6)
  await prisma.conversacionBot.deleteMany({
    where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
  })
})

after(async () => {
  if (creados.length) await prisma.reporte.deleteMany({ where: { id: { in: creados } } })
  await prisma.conversacionBot.deleteMany({
    where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
  })
  await prisma.$disconnect()
})


describe('consultar un folio ofrece qué hacer con él', () => {
  test('un reporte abierto deja agregar foto o información', async () => {
    const r = await reporteHasta('abierto', `bache, consulta abierta ${Date.now()}`)
    await di('hola'); await di('2')
    const salida = await di(r.folio)

    assert.ok(dice(salida, r.folio), 'debe mostrar el folio')
    assert.ok(dice(salida, 'Plazo comprometido'), 'y el plazo que se le prometió')
    const botones = uno(salida).botones?.map((b) => b.id) ?? []
    assert.ok(botones.includes('sumar_foto'), `esperaba agregar foto: ${botones}`)
    assert.ok(botones.includes('sumar_nota'), `esperaba agregar información: ${botones}`)
  })

  test('un folio inexistente no revienta', async () => {
    await di('hola'); await di('2')
    assert.ok(dice(await di('TUL-1999-99999'), 'No encontré ese folio'))
  })
})


describe('sumar información a un reporte abierto', () => {
  test('lo escrito queda en el expediente, sin pisar la descripción original', async () => {
    const marca = `fuga, nota de seguimiento ${Date.now()}`
    const r = await reporteHasta('abierto', marca)
    await di('hola'); await di('2'); await di(r.folio)
    await di('sumar_nota')
    const salida = await di('ya se llevó la mitad de la calle y no se puede pasar')

    assert.ok(dice(salida, 'Anotado'), uno(salida).texto)

    const evento = await prisma.eventoReporte.findFirst({
      where: { reporteId: r.id, tipo: 'comentario' },
      orderBy: { timestamp: 'desc' },
    })
    assert.ok(evento, 'debe quedar registrado como evento del reporte')
    const detalle = evento.detalle as { origen?: string; texto?: string }
    assert.equal(detalle.origen, 'ciudadano')
    assert.match(detalle.texto ?? '', /mitad de la calle/)

    // La descripción original es parte del expediente y no se toca: explica
    // las decisiones que ya se tomaron sobre el reporte.
    const actual = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { descripcion: true },
    })
    assert.equal(actual.descripcion, marca)
  })

  test('una nota demasiado corta pide más', async () => {
    const r = await reporteHasta('abierto', `bache, nota corta ${Date.now()}`)
    await di('hola'); await di('2'); await di(r.folio); await di('sumar_nota')
    assert.ok(dice(await di('ya'), 'un poco más'))
  })
})


describe('el ciudadano decide si el trabajo quedó', () => {
  test('al resolver se le pregunta, y la conversación queda esperando su respuesta', async () => {
    // La conversación tiene que existir antes: el aviso la busca por el chat.
    await di('hola')
    const r = await reporteHasta('resuelto', `bache, confirmación ${Date.now()}`)

    const conv = await prisma.conversacionBot.findFirstOrThrow({
      where: { canal: 'simulador', chatIdHash: hashTelefono(CHAT) },
      select: { estado: true },
    })
    const estado = conv.estado as { paso?: string; folio?: string }
    assert.equal(estado.paso, 'confirmando_resolucion',
      'sin esto, la respuesta del ciudadano cae al vacío')
    assert.equal(estado.folio, r.folio)
  })

  test('«sí quedó» pide calificación y cierra el reporte', async () => {
    await di('hola')
    const r = await reporteHasta('resuelto', `bache, sí quedó ${Date.now()}`)

    const pregunta = await di('quedo_si')
    assert.ok(dice(pregunta, 'Del 1 al 5'), uno(pregunta).texto)

    const fin = await di('5')
    assert.ok(dice(fin, 'queda cerrado'), uno(fin).texto)

    const actual = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { estatus: true, calificacion: true, cerradoAt: true },
    })
    assert.equal(actual.estatus, 'cerrado')
    assert.equal(actual.calificacion, 5)
    assert.ok(actual.cerradoAt, 'debe quedar la fecha de cierre')
  })

  test('«no, sigue igual» pide el motivo y reabre con plazo nuevo', async () => {
    await di('hola')
    const r = await reporteHasta('resuelto', `bache, no quedó ${Date.now()}`)

    const pide = await di('quedo_no')
    assert.ok(dice(pide, 'qué es lo que falta'), uno(pide).texto)

    const fin = await di('taparon solo la mitad y el hoyo sigue del otro lado')
    assert.ok(dice(fin, 'Reabrí'), uno(fin).texto)

    const actual = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id },
      select: { estatus: true, vecesReabierto: true, resueltoAt: true, calificacion: true },
    })
    assert.equal(actual.estatus, 'reabierto')
    assert.equal(actual.vecesReabierto, 1)
    assert.equal(actual.resueltoAt, null, 'ya no está resuelto')
    // Rechazar NO exige calificar primero: la persona está diciendo, viendo la
    // foto, que su problema sigue. Eso pesa más que una estrella.
    assert.equal(actual.calificacion, null)

    const evento = await prisma.eventoReporte.findFirst({
      where: { reporteId: r.id, tipo: 'reabierto' }, orderBy: { timestamp: 'desc' },
    })
    const detalle = evento?.detalle as { origen?: string; motivo?: string }
    assert.equal(detalle?.origen, 'ciudadano')
    assert.match(detalle?.motivo ?? '', /la mitad/)
  })

  test('contestar directo con la calificación también cierra', async () => {
    await di('hola')
    const r = await reporteHasta('resuelto', `bache, calificación directa ${Date.now()}`)

    const fin = await di('4')
    assert.ok(dice(fin, 'queda cerrado'), uno(fin).texto)
    const actual = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { estatus: true, calificacion: true },
    })
    assert.equal(actual.estatus, 'cerrado')
    assert.equal(actual.calificacion, 4)
  })

  test('un reporte ya cerrado no acepta aportes nuevos', async () => {
    await di('hola')
    const r = await reporteHasta('resuelto', `bache, ya cerrado ${Date.now()}`)
    await di('quedo_si'); await di('5')

    await di('menu'); await di('2')
    const salida = await di(r.folio)
    assert.ok(dice(salida, 'ya está cerrado'), uno(salida).texto)
  })
})
