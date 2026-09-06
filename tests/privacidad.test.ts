import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { descifrarTelefono } from '../src/lib/telefono'

/**
 * Revisión de privacidad de las superficies públicas (SPEC §12 fase 6,
 * criterio de aceptación 7: «Ningún endpoint público expone teléfono o nombre»).
 *
 * Se hace contra el servidor de verdad, no contra los `select` del código: lo
 * que importa no es lo que el código pretende publicar, sino lo que realmente
 * sale por el cable. Si el servidor no está arriba, las pruebas se saltan en
 * vez de fallar, para que `npm test` siga sirviendo sin levantarlo.
 */

const BASE = process.env.URL_PRUEBAS ?? 'http://localhost:3000'

let servidorArriba = false
let secretos: { etiqueta: string; valor: string }[] = []
let rutas: string[] = []

before(async () => {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(3000) })
    servidorArriba = r.ok
  } catch {
    servidorArriba = false
  }
  if (!servidorArriba) return

  // Se toma un reporte real que tenga datos de contacto: si el sistema filtra
  // algo, filtrará justo esto.
  const r = await prisma.reporte.findFirst({
    where: { telefonoCifrado: { not: null }, nombreContacto: { not: null }, direccionTexto: { not: null } },
    select: {
      folio: true, telefonoCifrado: true, telefonoMascara: true,
      nombreContacto: true, direccionTexto: true, descripcion: true,
      colonia: { select: { slug: true } },
    },
  })
  if (!r) return

  secretos = [
    { etiqueta: 'teléfono en claro', valor: descifrarTelefono(r.telefonoCifrado!) },
    { etiqueta: 'teléfono enmascarado', valor: r.telefonoMascara! },
    { etiqueta: 'teléfono cifrado', valor: r.telefonoCifrado!.slice(0, 20) },
    { etiqueta: 'nombre de quien reportó', valor: r.nombreContacto! },
  ]

  rutas = [
    '/',
    '/tablero',
    '/antes-despues',
    '/datos-abiertos',
    `/folio/${r.folio}`,
    ...(r.colonia ? [`/mi-colonia/${r.colonia.slug}`] : []),
    '/api/datos-abiertos/reportes.csv',
    '/api/datos-abiertos/reportes.json',
  ]
})

after(async () => { await prisma.$disconnect() })

describe('privacidad de las superficies públicas', () => {
  test('ninguna ruta pública expone teléfono ni nombre', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)
    if (secretos.length === 0) return t.skip('no hay un reporte con datos de contacto')

    for (const ruta of rutas) {
      const respuesta = await fetch(`${BASE}${ruta}`)
      assert.ok(respuesta.ok, `${ruta} respondió ${respuesta.status}`)
      const cuerpo = await respuesta.text()

      for (const s of secretos) {
        assert.ok(
          !cuerpo.includes(s.valor),
          `${ruta} está exponiendo ${s.etiqueta}`,
        )
      }
    }
  })

  test('los datos abiertos tampoco traen texto libre del ciudadano', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)

    const r = await prisma.reporte.findFirst({
      where: { direccionTexto: { not: null } },
      select: { descripcion: true, direccionTexto: true },
    })
    if (!r) return t.skip('sin reportes con dirección')

    for (const ruta of ['/api/datos-abiertos/reportes.csv', '/api/datos-abiertos/reportes.json']) {
      const cuerpo = await (await fetch(`${BASE}${ruta}`)).text()
      assert.ok(!cuerpo.includes(r.descripcion), `${ruta} publica la descripción del ciudadano`)
      assert.ok(!cuerpo.includes(r.direccionTexto!), `${ruta} publica la dirección exacta`)
    }
  })

  test('las rutas internas exigen sesión', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)

    for (const ruta of ['/bandeja', '/cuadrilla', '/ejecutivo', '/admin']) {
      const r = await fetch(`${BASE}${ruta}`, { redirect: 'manual' })
      assert.ok(
        r.status === 307 || r.status === 302,
        `${ruta} debería redirigir al login sin sesión, respondió ${r.status}`,
      )
    }
  })

  test('las tareas programadas exigen el secreto', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)

    for (const ruta of ['/api/cron/autocierre', '/api/cron/alertas', '/api/cron/indicadores', '/api/cron/mantenimiento']) {
      const sin = await fetch(`${BASE}${ruta}`)
      assert.equal(sin.status, 401, `${ruta} debería exigir el secreto`)

      const malo = await fetch(`${BASE}${ruta}`, { headers: { Authorization: 'Bearer incorrecto' } })
      assert.equal(malo.status, 401, `${ruta} aceptó un secreto incorrecto`)
    }
  })

  test('el webhook de Telegram rechaza sin su secreto', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)

    const r = await fetch(`${BASE}/api/webhooks/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { message_id: 1, chat: { id: 1 }, text: 'hola' } }),
    })
    assert.equal(r.status, 401)
  })

  test('las cabeceras de seguridad están puestas', async (t) => {
    if (!servidorArriba) return t.skip(`servidor no disponible en ${BASE}`)

    const h = (await fetch(`${BASE}/reportar`)).headers
    assert.ok(h.get('content-security-policy')?.includes("frame-ancestors 'none'"), 'falta frame-ancestors')
    assert.equal(h.get('x-content-type-options'), 'nosniff')
    assert.equal(h.get('x-frame-options'), 'DENY')
    assert.ok(h.get('referrer-policy'), 'falta Referrer-Policy')
    assert.ok(h.get('permissions-policy')?.includes('camera=()'), 'falta Permissions-Policy')
  })
})
