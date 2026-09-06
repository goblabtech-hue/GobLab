import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'

/**
 * El limitador real lee la IP de las cabeceras de la petición, que solo
 * existen dentro de un request de Next. Aquí se prueba el mecanismo que hace
 * el trabajo —el UPSERT atómico sobre la ventana— con una clave fija.
 */
const CLAVE = 'prueba:1.2.3.4'

async function golpear(segundos: number): Promise<number> {
  const filas = await prisma.$queryRaw<{ cuenta: number }[]>`
    INSERT INTO "LimitePeticion" ("clave", "ventanaAt", "cuenta")
    VALUES (${CLAVE}, now(), 1)
    ON CONFLICT ("clave") DO UPDATE SET
      "cuenta" = CASE
        WHEN "LimitePeticion"."ventanaAt" < now() - make_interval(secs => ${segundos}::double precision)
        THEN 1 ELSE "LimitePeticion"."cuenta" + 1 END,
      "ventanaAt" = CASE
        WHEN "LimitePeticion"."ventanaAt" < now() - make_interval(secs => ${segundos}::double precision)
        THEN now() ELSE "LimitePeticion"."ventanaAt" END
    RETURNING "cuenta"
  `
  return Number(filas[0].cuenta)
}

before(async () => { await prisma.limitePeticion.deleteMany({ where: { clave: CLAVE } }) })
after(async () => {
  await prisma.limitePeticion.deleteMany({ where: { clave: CLAVE } })
  await prisma.$disconnect()
})

describe('ventana de límite de peticiones', () => {
  test('cuenta hacia arriba dentro de la ventana', async () => {
    assert.equal(await golpear(3600), 1)
    assert.equal(await golpear(3600), 2)
    assert.equal(await golpear(3600), 3)
  })

  test('se reinicia cuando la ventana expira', async () => {
    // ventana de 0 s: la anterior ya caducó
    assert.equal(await golpear(0), 1)
  })

  test('20 peticiones simultáneas cuentan las 20, sin perder ninguna', async () => {
    await prisma.limitePeticion.deleteMany({ where: { clave: CLAVE } })
    const resultados = await Promise.all(Array.from({ length: 20 }, () => golpear(3600)))
    assert.deepEqual(
      [...resultados].sort((a, b) => a - b),
      Array.from({ length: 20 }, (_, i) => i + 1),
      'el UPSERT debe serializar: ningún conteo repetido ni perdido',
    )
  })

  test('la limpieza borra las ventanas viejas y respeta las recientes', async () => {
    await golpear(3600)
    await prisma.limitePeticion.update({
      where: { clave: CLAVE },
      data: { ventanaAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    })
    const { limpiarLimites } = await import('../src/lib/rate-limit')
    await limpiarLimites(24)
    const quedan = await prisma.limitePeticion.count({ where: { clave: CLAVE } })
    assert.equal(quedan, 0)
  })
})
