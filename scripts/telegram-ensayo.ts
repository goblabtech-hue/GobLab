import 'dotenv/config'
import { prisma } from '../src/infrastructure/prisma'
import { hashTelefono } from '../src/domain/telefono'

/**
 * Ensayo del canal de Telegram, sin Telegram.
 *
 * Levanta una conversación completa contra el webhook real —el mismo endpoint,
 * la misma verificación de secreto, el mismo motor— pero alimentándolo con los
 * objetos `Update` exactos que mandan los servidores de Telegram. Sirve para
 * dos cosas:
 *
 *   · Probar el flujo de punta a punta antes de tener token de @BotFather.
 *   · Detectar regresiones en el canal después de tocar el bot, sin depender
 *     de un servicio externo ni de un túnel.
 *
 * Lo único que NO se ejercita es la entrega de vuelta hacia Telegram
 * (`sendMessage`), que sí necesita el token. Las respuestas se leen de la base,
 * que es donde el bot las escribe antes de intentar enviarlas.
 *
 *   npx tsx scripts/telegram-ensayo.ts
 *   npx tsx scripts/telegram-ensayo.ts http://localhost:3000
 */

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const SECRETO = process.env.TELEGRAM_WEBHOOK_SECRET
const CHAT_ID = 900000000 + Math.floor(Math.random() * 99_999_999)
const NOMBRE = 'Laura'

let updateId = 1
let messageId = 100

const azul = (t: string) => `\x1b[36m${t}\x1b[0m`
const gris = (t: string) => `\x1b[2m${t}\x1b[0m`
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`

// El chat id se guarda hasheado, nunca en claro (DECISIONES C-05): para
// encontrar la conversación hay que buscar por el mismo hash que usa el bot.
const CHAT_HASH = hashTelefono(String(CHAT_ID))

const de = { id: CHAT_ID, is_bot: false, first_name: NOMBRE, language_code: 'es' }
const chat = { id: CHAT_ID, first_name: NOMBRE, type: 'private' }
const sobre = (extra: Record<string, unknown>) => ({
  update_id: updateId++,
  message: {
    message_id: messageId++,
    from: de,
    chat,
    date: Math.floor(Date.now() / 1000),
    ...extra,
  },
})

/** Los tres tipos de Update que produce este bot. */
const texto = (t: string) => sobre({ text: t })
const ubicacion = (lat: number, lng: number) => sobre({ location: { latitude: lat, longitude: lng } })
const boton = (data: string) => ({
  update_id: updateId++,
  callback_query: {
    id: String(4_382_000_000 + updateId),
    from: de,
    message: { message_id: messageId++, from: { is_bot: true }, chat, date: Math.floor(Date.now() / 1000) },
    data,
  },
})

async function entregar(update: unknown): Promise<string[]> {
  const antes = await prisma.mensajeBot.count({
    where: { conversacion: { is: { chatIdHash: CHAT_HASH } }, direccion: 'out' },
  })

  const r = await fetch(`${BASE}/api/webhooks/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRETO ?? '',
    },
    body: JSON.stringify(update),
  })
  if (!r.ok) throw new Error(`El webhook respondió ${r.status}: ${await r.text()}`)

  const salidas = await prisma.mensajeBot.findMany({
    where: { conversacion: { is: { chatIdHash: CHAT_HASH } }, direccion: 'out' },
    orderBy: { timestamp: 'asc' },
    select: { texto: true },
    skip: antes,
  })
  return salidas.map((s) => s.texto)
}

function pintarCiudadano(t: string) { console.log(`\n${azul(`${NOMBRE} ▸`)} ${t}`) }
function pintarBot(textos: string[]) {
  for (const t of textos) {
    console.log(gris('\n  Bot ▾'))
    for (const linea of t.split('\n')) console.log(`  ${linea}`)
  }
}

/** Busca en un menú numerado la opción que menciona alguna de estas palabras. */
function opcionQueMenciona(menu: string, palabras: string[]): string | null {
  for (const linea of menu.split('\n')) {
    const m = /^\s*(\d+)\.\s+(.*)$/.exec(linea)
    if (!m) continue
    const etiqueta = m[2]!.toLowerCase()
    if (palabras.some((p) => etiqueta.includes(p))) return m[1]!
  }
  return null
}

async function paso(update: unknown, comoSeVe: string): Promise<string[]> {
  pintarCiudadano(comoSeVe)
  const salidas = await entregar(update)
  pintarBot(salidas)
  return salidas
}

const ultimo = (xs: string[]) => xs[xs.length - 1] ?? ''

async function main() {
  if (!SECRETO) {
    console.error('Falta TELEGRAM_WEBHOOK_SECRET en .env. Corre ./scripts/telegram-conectar.sh')
    process.exit(1)
  }

  console.log(gris(`Ensayo del canal Telegram contra ${BASE}`))
  console.log(gris(`Chat simulado: ${CHAT_ID}  (un ciudadano que nunca ha escrito)`))

  await paso(texto('/start'), '/start')

  let r = await paso(
    texto('Buenas, hay un bache muy grande en la calle Zaragoza casi esquina con Hidalgo, ya se ponchó una llanta ahí'),
    'Buenas, hay un bache muy grande en la calle Zaragoza…',
  )

  // El bot puede proponer categoría (con IA) o pedir que se elija de una lista
  // (sin IA). El ensayo atiende las dos, porque las dos ocurren en producción.
  if (/¿Es correcto\?/.test(ultimo(r))) {
    r = await paso(boton('si'), '[toca «Sí, es eso»]')
  } else {
    const n = opcionQueMenciona(ultimo(r), ['bache', 'pavimento', 'calle', 'vialidad'])
    if (!n) throw new Error('No encontré una categoría de bacheo en el menú.')
    r = await paso(texto(n), n)
  }

  // La foto se omite a propósito: descargarla exige el token del bot.
  r = await paso(texto('seguir'), 'seguir  (sin foto)')

  r = await paso(ubicacion(20.0533, -99.3421), '[comparte su ubicación: 20.0533, -99.3421]')

  if (/¿Es el mismo problema\?/.test(ultimo(r))) {
    r = await paso(boton('no'), '[toca «No, es otro»]')
  }

  r = await paso(boton('si'), '[toca «Sí, envíalo»]')

  // ── Verificación contra la base ────────────────────────────────────────────
  const conv = await prisma.conversacionBot.findFirstOrThrow({
    where: { chatIdHash: CHAT_HASH },
    select: { canal: true, reporte: {
      select: {
        folio: true, origen: true, estatus: true, fechaLimite: true,
        // El SLA que se le prometió a ESTE reporte, no el vigente en la
        // categoría: cambiar la promesa no debe reescribir la del pasado.
        slaDiasHabilesAplicado: true,
        descripcion: true, lat: true, lng: true, canalNotificacion: true,
        categoria: { select: { nombre: true } },
        // La dependencia del reporte es la que realmente lo va a atender:
        // puede haber sido reasignada después del ruteo automático.
        dependencia: { select: { nombre: true, responsable: true, telefono: true } },
        colonia: { select: { nombre: true } },
      },
    } },
  })
  const rep = conv.reporte
  if (!rep) throw new Error('La conversación terminó sin reporte.')

  console.log(`\n${verde('─── Lo que quedó en la base ───')}`)
  console.log(`  Folio           ${rep.folio}`)
  console.log(`  Origen          ${rep.origen}`)
  console.log(`  Estatus         ${rep.estatus}`)
  console.log(`  Categoría       ${rep.categoria.nombre}`)
  console.log(`  Área responsable ${rep.dependencia.nombre}`)
  console.log(`  Titular         ${rep.dependencia.responsable} · ${rep.dependencia.telefono}`)
  console.log(`  Colonia         ${rep.colonia?.nombre ?? '(por coordenadas)'}`)
  console.log(`  Coordenadas     ${rep.lat}, ${rep.lng}`)
  console.log(`  SLA             ${rep.slaDiasHabilesAplicado} días hábiles → ${rep.fechaLimite.toISOString().slice(0, 10)}`)
  console.log(`  Avisar por      ${rep.canalNotificacion}`)

  const fallas: string[] = []
  if (conv.canal !== 'telegram') fallas.push(`la conversación quedó en canal "${conv.canal}"`)
  if (rep.origen !== 'telegram') fallas.push(`el origen quedó como "${rep.origen}" y debía ser "telegram"`)
  if (rep.canalNotificacion !== 'telegram') fallas.push(`las notificaciones irían por "${rep.canalNotificacion}"`)
  if (rep.lat == null || rep.lng == null) fallas.push('no se guardaron las coordenadas')

  console.log()
  if (fallas.length) {
    console.error(`\x1b[31m✗ El ensayo encontró problemas:\x1b[0m`)
    for (const f of fallas) console.error(`   · ${f}`)
    process.exit(1)
  }
  console.log(verde(`✓ Reporte ${rep.folio} creado por el canal de Telegram.`))
  console.log(gris(`   Búscalo en ${BASE}/folio/${rep.folio} y en la bandeja interna.`))
}

main()
  .catch((e) => { console.error(`\n\x1b[31m${e instanceof Error ? e.message : e}\x1b[0m`); process.exit(1) })
  .finally(() => prisma.$disconnect())
