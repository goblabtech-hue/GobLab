import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'

/**
 * El registro del teléfono de la app de las tiendas. Se prueba contra el
 * servidor vivo porque el limitador de peticiones lee la IP de la petición.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
let arriba = false
let folio = ''
const TOKEN = `prueba-token-${Date.now()}-abcdefghijklmnopqrstuvwxyz`

const registrar = (cuerpo: unknown) =>
  fetch(`${BASE}/api/app/dispositivo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  })

before(async () => {
  try { arriba = (await fetch(BASE, { signal: AbortSignal.timeout(3000) })).ok } catch { arriba = false }
  // Un folio del seed, no cualquiera: las suites corren en paralelo y crean
  // reportes que borran al terminar; ligar el teléfono a uno de esos fallaría
  // con 404 a media prueba.
  const r = await prisma.reporte.findFirst({
    where: { NOT: { descripcion: { contains: 'prueba' } } },
    orderBy: { createdAt: 'asc' }, select: { folio: true },
  })
  folio = r?.folio ?? ''
})

after(async () => {
  await prisma.dispositivoPush.deleteMany({ where: { token: { startsWith: 'prueba-token-' } } })
  await prisma.$disconnect()
})

describe('la app registra su teléfono', () => {
  test('sin folio: queda el token, sin seguir nada', async (t) => {
    if (!arriba) return t.skip('servidor no disponible')
    const r = await registrar({ token: TOKEN, plataforma: 'ios' })
    assert.equal(r.status, 200)
    const d = await prisma.dispositivoPush.findUniqueOrThrow({ where: { token: TOKEN } })
    assert.equal(d.plataforma, 'ios')
    assert.deepEqual(d.folios, [])
  })

  test('con folio: el teléfono sigue ese folio, sin duplicarlo', async (t) => {
    if (!arriba || !folio) return t.skip('sin servidor o sin reportes')
    await registrar({ token: TOKEN, plataforma: 'ios', folio })
    await registrar({ token: TOKEN, plataforma: 'ios', folio })
    const d = await prisma.dispositivoPush.findUniqueOrThrow({ where: { token: TOKEN } })
    assert.deepEqual(d.folios, [folio])
  })

  test('un folio inexistente no se liga', async (t) => {
    if (!arriba) return t.skip('servidor no disponible')
    const r = await registrar({ token: TOKEN, plataforma: 'android', folio: 'TUL-1999-99999' })
    assert.equal(r.status, 404)
  })

  test('datos inválidos se rechazan con 400', async (t) => {
    if (!arriba) return t.skip('servidor no disponible')
    assert.equal((await registrar({ token: 'corto', plataforma: 'ios' })).status, 400)
    assert.equal((await registrar({ token: TOKEN, plataforma: 'windows' })).status, 400)
    assert.equal((await fetch(`${BASE}/api/app/dispositivo`, { method: 'POST', body: '{' })).status, 400)
  })

  test('nunca guarda quién es la persona: solo token, plataforma y folios', () => {
    // Si alguien agrega nombre o teléfono al modelo, esto lo detiene.
    const campos = Object.keys(prisma.dispositivoPush.fields)
    assert.deepEqual(campos.sort(), ['createdAt', 'folios', 'id', 'plataforma', 'token', 'updatedAt'])
  })
})
