import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { CATALOGO_CATEGORIAS } from '@/domain/catalogo-categorias'

export const metadata = {
  title: { absolute: 'DemosVoz · Cada reporte con dueño, plazo y foto' },
  description:
    'La plataforma de atención ciudadana para municipios de México: cada reporte llega al área correcta, con un plazo público, y se cierra con evidencia cuando el vecino confirma.',
}
export const dynamic = 'force-dynamic'

/**
 * La página del producto.
 *
 * Cuenta un solo reporte de principio a fin, enseña el producto en grande y
 * usa el marino y el cian del logotipo con fuerza. Cada afirmación es algo
 * construido y probado; las cifras salen de la base al renderizar.
 */

const MARINO = '#0b1a33'
const LIMA = '#8dc63f'

async function cifrasVivas() {
  const hace12 = new Date(Date.now() - 365 * 86_400_000)
  const [recibidos, resueltos, aTiempo, calif, colonias, dependencias] = await Promise.all([
    prisma.reporte.count({ where: { createdAt: { gte: hace12 } } }),
    prisma.reporte.count({ where: { createdAt: { gte: hace12 }, resueltoAt: { not: null } } }),
    prisma.$queryRaw<{ pct: number | null }[]>`
      SELECT round(100.0 * count(*) FILTER (WHERE "resueltoAt" <= "fechaLimite") / nullif(count(*), 0)) AS pct
      FROM "Reporte" WHERE "resueltoAt" IS NOT NULL AND "createdAt" >= ${hace12}`,
    prisma.reporte.aggregate({ _avg: { calificacion: true } }),
    prisma.colonia.count(),
    prisma.dependencia.count({ where: { activa: true } }),
  ])
  return {
    recibidos, resueltos,
    pctTiempo: Number(aTiempo[0]?.pct ?? 0),
    calif: calif._avg.calificacion ? calif._avg.calificacion.toFixed(1) : '—',
    colonias, dependencias,
  }
}

export default async function Plataforma() {
  const c = await cifrasVivas()

  return (
    <article>

      {/* ═══ Portada ═══════════════════════════════════════════════════════ */}
      <section className="text-white" style={{ background: MARINO }}>
        <div className="mx-auto max-w-6xl px-5 pt-20 pb-16 md:pt-28 md:pb-20">
          <p className="text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: LIMA }}>
            Atención ciudadana para municipios de México
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight text-balance md:text-7xl">
            Cada reporte con dueño, plazo y foto.
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-white/75">
            El vecino reporta por WhatsApp. El sistema lo manda al área que lo atiende, le pone un
            plazo público, y no lo cierra hasta que hay evidencia — y el vecino dice que quedó.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/inicio" className="btn-principal inline-flex h-13 items-center gap-2 rounded-lg px-7 text-base font-semibold text-white">
              Ver la demostración <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/contacto" className="inline-flex h-13 items-center rounded-lg border border-white/30 px-7 text-base font-semibold text-white hover:bg-white/10">
              Hablar con ventas
            </Link>
          </div>
        </div>

        {/* Cifras vivas */}
        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/10 px-5 md:grid-cols-4">
            {[
              [c.recibidos.toLocaleString('es-MX'), 'reportes recibidos', 'últimos 12 meses'],
              [c.resueltos.toLocaleString('es-MX'), 'resueltos', 'con foto de evidencia'],
              [`${c.pctTiempo}%`, 'dentro del plazo', 'el plazo es público'],
              [c.calif, 'de 5', 'calificación de la gente'],
            ].map(([n, t, s]) => (
              <div key={t} className="px-5 py-6 first:pl-0">
                <p className="text-4xl font-bold tabular-nums tracking-tight">{n}</p>
                <p className="mt-1 text-sm font-medium">{t}</p>
                <p className="text-xs text-white/50">{s}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto max-w-6xl px-5 pb-4 text-xs text-white/40">
            Cifras de la demostración, tal como están ahora mismo en el sistema.
          </p>
        </div>
      </section>

      {/* ═══ Un reporte, de principio a fin ═══════════════════════════════ */}
      <section id="reporte" className="bg-papel text-tinta">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
            Un bache, desde que lo reportan hasta que la vecina dice «ya quedó».
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-tinta-suave">
            Así se ve un reporte dentro de DemosVoz. Cada paso lo dispara alguien; el sistema se
            encarga de que nada se quede en el aire.
          </p>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {/* riel */}
            <div aria-hidden className="absolute top-5 right-0 left-0 hidden h-0.5 md:block" style={{ background: `linear-gradient(to right, #007595, #155dfc)` }} />
            {[
              { dia: 'Día 0 · 9:14', quien: 'Laura, vecina', que: 'Escribe por WhatsApp: «hay un bache enorme en Zaragoza esquina Hidalgo, ya se ponchó una llanta». Manda la foto y su ubicación.', sistema: 'Entiende que es un bache, detecta que no hay otro igual a 100 m, y le da folio: TUL-2026-00346. Plazo: 5 días hábiles.', img: '/marca/escena-antes.jpg' },
              { dia: 'Día 0 · 9:15', quien: 'Obras Públicas', que: 'Al titular le llega el aviso al correo y al Telegram. Aparece en la bandeja del área con el plazo corriendo.', sistema: 'Ruteado sin que nadie lo toque. Si venciera sin atenderse, avisaría solo.' },
              { dia: 'Día 2 · 11:40', quien: 'Pedro, cuadrilla', que: 'Lo recibe en su teléfono. Marca que empezó. Al terminar, sube la foto del parche.', sistema: 'Sin foto no hay cierre. La evidencia queda en el expediente, con hora y quién.', img: '/marca/escena-despues.jpg' },
              { dia: 'Día 2 · 11:41', quien: 'Laura, otra vez', que: 'Le llega la foto: «Terminamos. ¿Quedó resuelto?». Toca «Sí» y califica con 5.', sistema: 'Si hubiera dicho «no», el reporte se reabre con plazo nuevo y el área se entera. El cierre lo da el vecino, no el sistema.' },
              { dia: 'Lunes · 8:00', quien: 'La dirección', que: 'En el informe semanal: Obras Públicas resolvió 10, 100% a tiempo, 2.0 días promedio. Y qué lleva más tiempo esperando.', sistema: 'El mismo dato va al tablero público, por colonia. Cualquiera lo puede ver.' },
              { dia: 'Siempre', quien: 'Cualquier vecino', que: 'Abre «Cómo vamos» y ve cuánto tarda el municipio en cada tipo de problema, y si cumple lo que prometió.', sistema: 'Los plazos son públicos y se miden contra el cumplimiento real. Es rendición de cuentas en vivo.' },
            ].map((p, i) => (
              <li key={p.dia} className="relative">
                <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white md:relative md:z-10" style={{ background: `linear-gradient(135deg, #007595, #155dfc)` }}>{i + 1}</span>
                <p className="mt-4 text-xs font-semibold tracking-wide text-marca-600 uppercase">{p.dia}</p>
                <h3 className="mt-1 text-lg font-bold">{p.quien}</h3>
                <p className="mt-2 text-tinta-suave">{p.que}</p>
                <p className="mt-3 border-l-2 pl-3 text-sm text-tinta-suave" style={{ borderColor: LIMA }}>
                  <span className="font-semibold text-tinta">DemosVoz: </span>{p.sistema}
                </p>
                {p.img && (
                  <Image src={p.img} alt="" width={1200} height={900} className="mt-4 aspect-[4/3] w-full rounded-lg object-cover" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ Hoy / Con DemosVoz ═══════════════════════════════════════════ */}
      <section id="cambio" className="text-white" style={{ background: MARINO }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
            Lo que cambia en cómo se administra.
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">Hoy, en la mayoría de los municipios</p>
              <ul className="mt-6 space-y-5 text-lg text-white/60">
                {[
                  'Los reportes llegan por teléfono, Facebook, el WhatsApp del regidor y ventanilla. Viven en cuadernos y chats.',
                  'Nadie sabe cuántos hay abiertos ni desde cuándo.',
                  '«Lo vamos a atender» no dice cuándo. No hay plazo, así que no hay incumplimiento.',
                  'Se cierran porque alguien dijo que ya. La foto, si existe, está en un celular.',
                  'El vecino nunca se entera. Vuelve a reportar lo mismo, o deja de reportar.',
                  'El lunes, la junta se hace de memoria.',
                ].map((t) => <li key={t} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-white/30" />{t}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }}>
              <p className="text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: LIMA }}>Con DemosVoz</p>
              <ul className="mt-6 space-y-5 text-lg">
                {[
                  ['Un solo lugar.', 'WhatsApp, Telegram, la app, la web y la ventanilla entran a la misma bandeja.'],
                  ['Cada reporte tiene dueño.', 'Va solo al área que lo atiende, y esa área se entera al instante.'],
                  ['Cada tipo de problema tiene plazo.', 'Público, en días hábiles. Se le dice al vecino y se mide.'],
                  ['Nada se cierra sin foto.', 'Y nada queda cerrado si el vecino dice que sigue.'],
                  ['El vecino sabe.', 'Le avisan al asignar, al terminar, al reabrir. Puede sumar fotos e información.'],
                  ['El lunes hay informe.', 'Por dependencia: resuelto, a tiempo, pendiente, y lo que más lleva esperando.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-1 size-5 shrink-0" style={{ color: LIMA }} aria-hidden />
                    <span><strong>{t}</strong> <span className="text-white/75">{d}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ El informe del lunes ═════════════════════════════════════════ */}
      <section id="informe" className="bg-papel text-tinta">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
              Lo que ve la dirección el lunes.
            </h2>
            <p className="max-w-sm text-tinta-suave">
              Por dependencia y por semana. Se imprime y se lleva a la junta. Ya no se discute de
              memoria.
            </p>
          </div>
          <div className="relative mt-10">
            <Image src="/marca/capturas/semanal.jpg" alt="El informe semanal por dependencia" width={1600} height={950} className="w-full rounded-xl border border-borde shadow-2xl" />
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              ['Resueltos y a tiempo', 'Cuántos cerró cada área esta semana y cuántos dentro del plazo que el municipio prometió. Con la comparación contra la semana anterior.'],
              ['Lo que lleva más tiempo', 'Los cinco reportes más viejos de cada área, con días de atraso. Son los que hay que explicar en la junta.'],
              ['Vencidos que avisan solos', 'Cuando un reporte pasa su fecha límite, el titular y la cuadrilla se enteran sin que nadie tenga que acordarse.'],
            ].map(([t, d]) => (
              <div key={t}><h3 className="font-bold">{t}</h3><p className="mt-1.5 text-sm text-tinta-suave">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Por donde la gente ya habla ═════════════════════════════════ */}
      <section id="whatsapp" className="bg-lienzo text-tinta">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
              Por donde la gente ya habla.
            </h2>
            <p className="mt-5 text-lg text-tinta-suave">
              Nadie instala la app de su municipio. Todo el mundo tiene WhatsApp. El asistente
              entiende el problema escrito con las palabras de la gente, pregunta solo lo que falta y
              entrega el folio.
            </p>
            <ul className="mt-6 space-y-2 text-tinta-suave">
              {[
                'Reconoce una emergencia y manda al 911 en vez de atenderla por chat.',
                'Detecta si ya hay un reporte igual a cien metros y ofrece sumarse.',
                'También por Telegram, por la web, y por la app en las tiendas.',
              ].map((t) => <li key={t} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-marca-600" aria-hidden />{t}</li>)}
            </ul>
          </div>

          {/* Conversación real, de la primera prueba del bot */}
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border-8 bg-[#e5ddd5] p-3 shadow-2xl" style={{ borderColor: MARINO }}>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold">
              <span className="size-7 rounded-full" style={{ background: `linear-gradient(135deg, #007595, #155dfc)` }} /> Atención Ciudadana Tula
            </div>
            <div className="space-y-2 text-[13px] leading-snug">
              {[
                ['in', 'esta un bache y unnperro muerte en frente de mi casa'],
                ['out', 'Entendí que se trata de: Bache en la calle. ¿Es correcto?'],
                ['in', 'si'],
                ['out', '¿Tienes una foto? Mándala y ayuda mucho a la cuadrilla a saber qué llevar.'],
                ['in', '📷 Foto'],
                ['out', '¿Dónde está el problema? Puedes mandarme tu ubicación, o escribir la calle y la colonia.'],
                ['in', 'calle tulipanes, acoculco'],
                ['out', 'Voy a registrar esto:\n📌 Bache en la calle\n📍 calle tulipanes · Col. Acoculco\n¿Lo mando así?'],
                ['in', 'si'],
                ['out', '✅ Listo. Tu folio es TUL-2026-00346.\nNos comprometemos a atenderlo en máximo 5 días hábiles, a más tardar el 17 de septiembre.'],
              ].map(([lado, texto], i) => (
                <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-line shadow-sm ${lado === 'in' ? 'ml-auto bg-[#dcf8c6]' : 'bg-white'}`}>{texto}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Y todo eso, público ═════════════════════════════════════════ */}
      <section className="bg-papel text-tinta">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
              Y todo eso, público.
            </h2>
            <p className="max-w-sm text-tinta-suave">
              Lo mismo que ve la dirección lo ve cualquier vecino. Por colonia, con datos abiertos
              para descargar.
            </p>
          </div>
          <Image src="/marca/capturas/tablero.jpg" alt="El tablero público «Cómo vamos»" width={1600} height={950} className="mt-10 w-full rounded-xl border border-borde shadow-2xl" />
          <p className="mt-6 max-w-3xl text-lg text-tinta-suave">
            Un municipio que usa DemosVoz está diciendo que se deja medir. Los plazos son públicos, el
            cumplimiento es público, la calificación de la gente es pública. Eso es lo que la
            distingue de un buzón de quejas.
          </p>
        </div>
      </section>

      {/* ═══ En una tarde ════════════════════════════════════════════════ */}
      <section id="arranque" className="text-white" style={{ background: MARINO }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
            Un municipio arranca en una tarde.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            No hay proyecto de meses ni migración. Lo propio de cada municipio se carga desde las
            pantallas de administración; lo demás ya está.
          </p>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Identidad', 'Nombre, escudo, folio. Cuatro identidades visuales, incluida la del Gobierno de México.'],
              ['Colonias', `Del catálogo de Correos de México, en tres clics. ${c.colonias} en esta demostración.`],
              ['Dependencias', `Con titular, teléfono y correo, desde Excel. ${c.dependencias} aquí.`],
              ['Problemas y plazos', `${CATALOGO_CATEGORIAS.length} en el catálogo; se activan con una casilla y traen plazo sugerido.`],
              ['Personal', 'Cuentas por rol, con su Telegram y WhatsApp para los avisos.'],
            ].map(([t, d], i) => (
              <li key={t}>
                <p className="text-3xl font-bold" style={{ color: LIMA }}>{i + 1}</p>
                <h3 className="mt-2 font-bold">{t}</h3>
                <p className="mt-1 text-sm text-white/65">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 grid gap-4 border-t border-white/10 pt-8 text-sm text-white/65 md:grid-cols-3">
            <p><strong className="text-white">Los datos se quedan en México.</strong> Servidor en el país, respaldo diario, teléfonos cifrados. Ninguna página pública expone nombre ni número.</p>
            <p><strong className="text-white">No atiende emergencias por chat.</strong> Las detecta y manda al 911. Tampoco recibe casos personales que no deben estar en un mapa.</p>
            <p><strong className="text-white">No es un buzón de quejas.</strong> Cada reporte tiene área, plazo y cierre confirmado. Si no, no entra.</p>
          </div>
        </div>
      </section>

      {/* ═══ Cierre ══════════════════════════════════════════════════════ */}
      <section className="text-white" style={{ background: 'linear-gradient(120deg, #007595, #155dfc)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">Véala con los datos de un municipio real.</h2>
            <p className="mt-2 text-white/80">Configurada como Tula de Allende, Hidalgo, con sus colonias y dependencias reales.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/inicio" className="inline-flex h-13 items-center gap-2 rounded-lg bg-white px-7 text-base font-semibold text-marca-700 hover:bg-white/90">
              Ver la demostración <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/contacto" className="inline-flex h-13 items-center rounded-lg border border-white/50 px-7 text-base font-semibold text-white hover:bg-white/10">
              Hablar con ventas
            </Link>
          </div>
        </div>
      </section>
    </article>
  )
}
