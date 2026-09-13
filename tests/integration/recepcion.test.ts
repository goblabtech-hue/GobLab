import 'dotenv/config'
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import { buzonDePrueba } from '../../src/infrastructure/correo'
import { enviadosDePrueba } from '../../src/infrastructure/mensajeria/simulador'
import { cifrarTelefono } from '../../src/domain/telefono'
import { procesarMensaje } from '../../src/application/bot/bot'
import {
  crearReporte, aceptarReporte, rechazarReporte, porValidar, asignarCuadrilla, ReglaDeNegocio,
} from '../../src/application/reportes'
import { hashearPassword } from '../../src/infrastructure/auth'

/**
 * Recepción: nada de lo que manda la gente existe para el municipio hasta que
 * una persona lo lee y decide. Sin filtros automáticos.
 */

const CHAT = '5593000001'
let dependenciaId: number
let categoriaId: number
let otraCategoriaId: number
let operadoraId: string
const creados: string[] = []
let n = 0

const di = (texto: string, extra: Record<string, unknown> = {}) =>
  procesarMensaje({ canal: 'simulador', chatId: CHAT, idExterno: `rc${Date.now()}-${++n}`, texto, ...extra })

before(async () => {
  process.env.SMTP_HOST = 'buzon-prueba'
  process.env.SMTP_FROM = 'pruebas@ejemplo.mx'
  const d = await prisma.dependencia.create({
    data: { nombre: `Recepción prueba ${Date.now()}`, responsable: 'Titular', telefono: '7730000000', correo: 'area-recepcion@ejemplo.mx' },
  })
  dependenciaId = d.id
  const [c1, c2] = await Promise.all([
    prisma.categoria.create({ data: { nombre: `Rc ${Date.now()}`, slug: `rc-${Date.now()}`, icono: 'wrench', slaDiasHabiles: 3, dependenciaId, orden: 998, activa: true } }),
    prisma.categoria.create({ data: { nombre: `Rc2 ${Date.now()}`, slug: `rc2-${Date.now()}`, icono: 'wrench', slaDiasHabiles: 5, dependenciaId, orden: 999, activa: true } }),
  ])
  categoriaId = c1.id; otraCategoriaId = c2.id
  const op = await prisma.usuario.create({
    data: { nombre: 'Operadora de prueba', email: `op-${Date.now()}@ejemplo.mx`, hashPassword: await hashearPassword('Prueba1234!'), rol: 'operador' },
  })
  operadoraId = op.id
})

beforeEach(() => { buzonDePrueba.length = 0; enviadosDePrueba.length = 0 })

after(async () => {
  await prisma.reporte.deleteMany({ where: { OR: [{ id: { in: creados } }, { categoriaId: { in: [categoriaId, otraCategoriaId] } }] } })
  await prisma.conversacionBot.deleteMany({ where: { canal: 'simulador', chatIdHash: (await import('../../src/domain/telefono')).hashTelefono(CHAT) } })
  await prisma.usuario.deleteMany({ where: { id: operadoraId } })
  await prisma.categoria.deleteMany({ where: { id: { in: [categoriaId, otraCategoriaId] } } })
  await prisma.dependencia.deleteMany({ where: { id: dependenciaId } })
  delete process.env.SMTP_HOST; delete process.env.SMTP_FROM
  await prisma.$disconnect()
})

async function delCiudadano(descripcion: string) {
  const r = await crearReporte({
    categoriaId, descripcion, origen: 'whatsapp',
    lat: 20.05, lng: -99.34, coloniaId: null, direccionTexto: 'calle de prueba 2',
    telefono: CHAT, nombreContacto: null, fotos: [],
  })
  creados.push(r.id)
  await prisma.reporte.update({ where: { id: r.id }, data: { canalNotificacion: 'simulador', destinoNotificacion: cifrarTelefono(CHAT) } })
  return r
}

const leer = (id: string) => prisma.reporte.findUniqueOrThrow({
  where: { id }, select: { estatus: true, moderacion: true, moderadoPorId: true, categoriaId: true, dependenciaId: true, motivoImprocedente: true },
})

describe('lo que manda la gente espera a una persona', () => {
  test('nace «por validar», sin avisar al área, y aparece en la bandeja de recepción', async () => {
    const r = await delCiudadano(`recepción espera ${Date.now()}`)
    const g = await leer(r.id)
    assert.equal(g.estatus, 'por_validar')
    assert.equal(g.moderacion, 'pendiente')
    assert.equal(buzonDePrueba.filter((c) => (c.para as string[]).includes('area-recepcion@ejemplo.mx')).length, 0,
      'el área no debe enterarse de algo que nadie ha validado')
    const cola = await porValidar()
    assert.ok(cola.some((x) => x.id === r.id), 'debe estar en la cola de recepción')
  })

  test('lo capturado por personal en ventanilla no pasa por recepción', async () => {
    const r = await crearReporte({
      categoriaId, descripcion: `ventanilla ${Date.now()}`, origen: 'ventanilla',
      lat: 20.05, lng: -99.34, coloniaId: null, direccionTexto: null,
      telefono: null, nombreContacto: null, fotos: [], capturadoPorId: operadoraId,
    })
    creados.push(r.id)
    const g = await leer(r.id)
    assert.equal(g.estatus, 'nuevo')
    assert.equal(g.moderacion, 'aprobado')
  })

  test('el área no puede trabajarlo antes de que se valide', async () => {
    const r = await delCiudadano(`recepción bloquea ${Date.now()}`)
    const cuadrilla = await prisma.usuario.findFirstOrThrow({ where: { rol: 'cuadrilla' } })
    await assert.rejects(asignarCuadrilla(r.id, cuadrilla.id, operadoraId), ReglaDeNegocio)
  })
})

describe('la persona decide', () => {
  test('registrar: pasa a nuevo, queda con su nombre y ahora sí se avisa al área', async () => {
    const r = await delCiudadano(`recepción acepta ${Date.now()}`)
    await aceptarReporte({ reporteId: r.id, userId: operadoraId })
    const g = await leer(r.id)
    assert.equal(g.estatus, 'nuevo')
    assert.equal(g.moderacion, 'aprobado')
    assert.equal(g.moderadoPorId, operadoraId)
    assert.ok(buzonDePrueba.some((c) => (c.para as string[]).includes('area-recepcion@ejemplo.mx')), 'al registrar sí se avisa al área')
    const ev = await prisma.eventoReporte.findFirst({ where: { reporteId: r.id, userId: operadoraId, tipo: 'comentario' } })
    assert.equal((ev?.detalle as { recepcion?: string })?.recepcion, 'aceptado')
  })

  test('registrar corrigiendo la categoría lo manda al área correcta', async () => {
    const r = await delCiudadano(`recepción corrige ${Date.now()}`)
    await aceptarReporte({ reporteId: r.id, userId: operadoraId, categoriaId: otraCategoriaId })
    const g = await leer(r.id)
    assert.equal(g.categoriaId, otraCategoriaId)
    assert.equal(g.dependenciaId, dependenciaId)
  })

  test('registrar ocultando: el problema se atiende pero el texto no es público', async () => {
    const r = await delCiudadano(`PINCHES INÚTILES arreglen la lámpara ${Date.now()}`)
    await aceptarReporte({ reporteId: r.id, userId: operadoraId, ocultarContenido: true })
    const g = await leer(r.id)
    assert.equal(g.estatus, 'nuevo')
    assert.equal(g.moderacion, 'oculto')
  })

  test('no registrar: queda improcedente, oculto, y el ciudadano recibe el motivo', async () => {
    const r = await delCiudadano(`vendo tinacos ${Date.now()}`)
    await rechazarReporte(r.id, operadoraId, 'No es un problema de servicios públicos.')
    const g = await leer(r.id)
    assert.equal(g.estatus, 'improcedente')
    assert.equal(g.moderacion, 'oculto')
    assert.equal(g.motivoImprocedente, 'No es un problema de servicios públicos.')
    const aviso = enviadosDePrueba.find((m) => m.chatId === CHAT)
    assert.ok(aviso?.texto.includes('No es un problema de servicios públicos.'), 'el ciudadano debe leer por qué')
  })

  test('sin motivo no se rechaza, y no se decide dos veces', async () => {
    const r = await delCiudadano(`recepción dos veces ${Date.now()}`)
    await assert.rejects(rechazarReporte(r.id, operadoraId, '  '), ReglaDeNegocio)
    await aceptarReporte({ reporteId: r.id, userId: operadoraId })
    await assert.rejects(aceptarReporte({ reporteId: r.id, userId: operadoraId }), ReglaDeNegocio)
    await assert.rejects(rechazarReporte(r.id, operadoraId, 'ya tarde'), ReglaDeNegocio)
  })
})

describe('mientras espera, el ciudadano', () => {
  test('ve su folio como recibido y puede sumarle una foto', async () => {
    const r = await delCiudadano(`recepción foto ${Date.now()}`)
    await di('hola'); await di('2')
    const salida = await di(r.folio)
    assert.ok(salida.some((m) => m.texto.toLowerCase().includes('validación')), `debe decir que está en validación: ${salida.map((m) => m.texto).join(' | ')}`)
    assert.ok(salida.some((m) => m.botones?.some((b) => b.id === 'sumar_foto')), 'debe poder agregar foto')
  })
})
