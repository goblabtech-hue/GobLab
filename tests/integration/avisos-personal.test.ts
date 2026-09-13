import 'dotenv/config'
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { buzonDePrueba } from '../../src/infrastructure/correo'
import { enviadosDePrueba } from '../../src/infrastructure/mensajeria/simulador'
import { cifrarTelefono, hashTelefono } from '../../src/domain/telefono'
import { crearReporte, asignarCuadrilla, iniciarAtencion, resolverReporte, rechazarResolucion } from '../../src/application/reportes'
import { avisarVencidos } from '../../src/application/avisos-personal'
import { procesarMensaje } from '../../src/application/bot/bot'
import { hashearPassword } from '../../src/infrastructure/auth'

/**
 * Cada quien recibe lo suyo, por los canales que tenga conectados.
 *
 * Se prueba con una dependencia y personas creadas para la prueba: contar
 * sobre las del seed haría que el resultado dependiera de quién tenga qué
 * vinculado en ese momento.
 */

const CHAT_SUPERVISORA = '5592000001'
const CHAT_CUADRILLA = '5592000002'
let dependenciaId: number
let categoriaId: number
let supervisoraId: string
let cuadrillaId: string
const creados: string[] = []

const correosPara = (quien: string) =>
  buzonDePrueba.filter((c) => (c.para as string[]).includes(quien))
const chatsPara = (chatId: string) =>
  enviadosDePrueba.filter((m) => m.chatId === chatId)

before(async () => {
  process.env.SMTP_HOST = 'buzon-prueba'
  process.env.SMTP_FROM = 'pruebas@ejemplo.mx'
  // Que nada salga de la máquina, aunque .env traiga un token real de Telegram.
  process.env.MENSAJERIA_FORZAR_SIMULADOR = '1'

  const d = await prisma.dependencia.create({
    data: { nombre: `Área de prueba ${Date.now()}`, responsable: 'Titular', telefono: '7730000000', correo: 'area@ejemplo.mx' },
  })
  dependenciaId = d.id
  const c = await prisma.categoria.create({
    data: { nombre: `Cat ${Date.now()}`, slug: `cat-${Date.now()}`, icono: 'wrench', slaDiasHabiles: 2, dependenciaId, orden: 999, activa: true },
  })
  categoriaId = c.id
  const hash = await hashearPassword('Prueba1234!')
  const sup = await prisma.usuario.create({
    data: {
      nombre: 'Supervisora de prueba', email: `sup-${Date.now()}@ejemplo.mx`, hashPassword: hash,
      rol: 'supervisor', dependenciaId,
      // Telegram vinculado, sin WhatsApp.
      telegramChatIdCifrado: cifrarTelefono(CHAT_SUPERVISORA), telegramChatIdHash: hashTelefono(CHAT_SUPERVISORA),
    },
  })
  supervisoraId = sup.id
  const cua = await prisma.usuario.create({
    data: {
      nombre: 'Cuadrilla de prueba', email: `cua-${Date.now()}@ejemplo.mx`, hashPassword: hash,
      rol: 'cuadrilla', dependenciaId,
      // WhatsApp vinculado, sin Telegram.
      telefonoCifrado: cifrarTelefono(CHAT_CUADRILLA), telefonoHash: hashTelefono(CHAT_CUADRILLA),
    },
  })
  cuadrillaId = cua.id
})

beforeEach(() => {
  buzonDePrueba.length = 0
  enviadosDePrueba.length = 0
})

after(async () => {
  await prisma.reporte.deleteMany({ where: { categoriaId } })
  await prisma.usuario.deleteMany({ where: { id: { in: [supervisoraId, cuadrillaId] } } })
  await prisma.categoria.deleteMany({ where: { id: categoriaId } })
  await prisma.dependencia.deleteMany({ where: { id: dependenciaId } })
  delete process.env.SMTP_HOST
  delete process.env.SMTP_FROM
  delete process.env.MENSAJERIA_FORZAR_SIMULADOR
  await prisma.$disconnect()
})

async function nuevo(marca: string) {
  const r = await crearReporte({
    categoriaId, descripcion: marca, origen: 'web',
    lat: 20.05, lng: -99.34, coloniaId: null, direccionTexto: 'calle de prueba 1',
    telefono: null, nombreContacto: null, fotos: [],
  })
  creados.push(r.id)
  return r
}

describe('llega un reporte al área', () => {
  test('el correo institucional del área y la supervisora por su Telegram', async () => {
    const r = await nuevo(`aviso nuevo ${Date.now()}`)

    const alArea = correosPara('area@ejemplo.mx')
    assert.equal(alArea.length, 1, 'un correo al área')
    assert.match(alArea[0]!.asunto, /Nuevo reporte/)
    assert.ok(alArea[0]!.texto.includes(r.folio), 'con el folio')

    const tg = chatsPara(CHAT_SUPERVISORA)
    assert.equal(tg.length, 1, 'y a la supervisora por Telegram')
    assert.ok(tg[0]!.texto.includes(r.folio))

    assert.equal(chatsPara(CHAT_CUADRILLA).length, 0, 'la cuadrilla todavía no tiene nada que ver')
  })

  test('queda en la bitácora del reporte a quién se le avisó', async () => {
    const r = await nuevo(`bitácora ${Date.now()}`)
    const ev = await prisma.eventoReporte.findFirst({
      where: { reporteId: r.id, tipo: 'notificacion', detalle: { path: ['personal'], equals: 'nuevo_en_area' } },
    })
    assert.ok(ev, 'debe haber un evento de notificación al personal')
    const d = ev.detalle as { entregas?: { a: string; canales: string[] }[] }
    assert.ok(d.entregas?.some((e) => e.canales.includes('telegram')), JSON.stringify(d))
  })
})

describe('le asignan el reporte a alguien', () => {
  test('la cuadrilla se entera por su WhatsApp y su correo', async () => {
    const r = await nuevo(`asignación ${Date.now()}`)
    buzonDePrueba.length = 0; enviadosDePrueba.length = 0

    await asignarCuadrilla(r.id, cuadrillaId, supervisoraId)

    const wa = chatsPara(CHAT_CUADRILLA)
    assert.equal(wa.length, 1, 'un WhatsApp a la cuadrilla')
    assert.match(wa[0]!.texto, /Te tocó/)
    assert.ok(wa[0]!.texto.includes(r.folio))

    const cua = await prisma.usuario.findUniqueOrThrow({ where: { id: cuadrillaId }, select: { email: true } })
    assert.equal(correosPara(cua.email).length, 1, 'y su correo')
  })
})

describe('el ciudadano dice que no quedó', () => {
  test('se avisa al área y a quien lo tenía, con la palabra clave', async () => {
    const r = await nuevo(`reapertura ${Date.now()}`)
    await asignarCuadrilla(r.id, cuadrillaId, supervisoraId)
    await iniciarAtencion(r.id, cuadrillaId)
    await resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: ['/uploads/x.jpg'] })
    buzonDePrueba.length = 0; enviadosDePrueba.length = 0

    await rechazarResolucion(r.id, 'sigue el hoyo del otro lado')

    assert.ok(chatsPara(CHAT_SUPERVISORA).some((m) => /sigue/.test(m.texto)), 'supervisora por Telegram')
    assert.ok(chatsPara(CHAT_CUADRILLA).some((m) => /sigue/.test(m.texto)), 'cuadrilla por WhatsApp')
    assert.ok(correosPara('area@ejemplo.mx').some((c) => /reabri/i.test(c.asunto)), 'área por correo')
  })
})

describe('se venció el plazo', () => {
  test('avisa una sola vez por reporte, aunque el cron corra muchas veces', async () => {
    const r = await nuevo(`vencido ${Date.now()}`)
    await asignarCuadrilla(r.id, cuadrillaId, supervisoraId)
    // Se fuerza el vencimiento.
    await prisma.reporte.update({ where: { id: r.id }, data: { fechaLimite: new Date(Date.now() - 86_400_000) } })
    buzonDePrueba.length = 0; enviadosDePrueba.length = 0

    const primera = await avisarVencidos()
    assert.ok(primera >= 1, 'debe encontrar el vencido')
    assert.ok(correosPara('area@ejemplo.mx').some((c) => /vencido/i.test(c.asunto)))
    assert.ok(chatsPara(CHAT_CUADRILLA).some((m) => /fecha límite/.test(m.texto)))

    const antes = chatsPara(CHAT_CUADRILLA).length
    await avisarVencidos()
    await avisarVencidos()
    assert.equal(chatsPara(CHAT_CUADRILLA).length, antes, 'un cron que insiste cada hora no debe volver a avisar')
  })
})

describe('vincular el Telegram de un funcionario', () => {
  test('con el código, el chat queda ligado a la cuenta y el código se consume', async () => {
    const codigo = 'ABC234'
    await prisma.usuario.update({
      where: { id: cuadrillaId },
      data: { codigoVinculacion: codigo, codigoVinculacionExpira: new Date(Date.now() + 60_000) },
    })
    const chat = '5592000099'
    const salida = await procesarMensaje({ canal: 'simulador', chatId: chat, idExterno: `v${Date.now()}`, texto: `/vincular ${codigo}` })
    assert.match(salida[0]!.texto, /Listo, Cuadrilla de prueba/)

    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: cuadrillaId } })
    assert.equal(u.telegramChatIdHash, hashTelefono(chat))
    assert.equal(u.codigoVinculacion, null, 'el código es de un solo uso')

    const otra = await procesarMensaje({ canal: 'simulador', chatId: '5592000098', idExterno: `v2${Date.now()}`, texto: `/vincular ${codigo}` })
    assert.match(otra[0]!.texto, /no sirve o ya venció/)
    await prisma.conversacionBot.deleteMany({ where: { canal: 'simulador', chatIdHash: { in: [hashTelefono(chat), hashTelefono('5592000098')] } } })
  })

  test('un código vencido no vincula', async () => {
    await prisma.usuario.update({
      where: { id: supervisoraId },
      data: { codigoVinculacion: 'VENC99', codigoVinculacionExpira: new Date(Date.now() - 1000) },
    })
    const chat = '5592000097'
    const salida = await procesarMensaje({ canal: 'simulador', chatId: chat, idExterno: `v3${Date.now()}`, texto: 'vincular venc99' })
    assert.match(salida[0]!.texto, /no sirve o ya venció/)
    await prisma.conversacionBot.deleteMany({ where: { canal: 'simulador', chatIdHash: hashTelefono(chat) } })
  })
})
