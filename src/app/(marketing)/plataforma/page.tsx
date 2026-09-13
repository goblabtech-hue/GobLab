import Image from 'next/image'
import Link from 'next/link'
import {
  MessageCircle, Smartphone, Globe, Clock, Camera, CheckCircle2, BarChart3,
  Route, Bell, CalendarRange, ShieldCheck, Database, FileSpreadsheet, ArrowRight,
  XCircle, HelpCircle, EyeOff, Layers,
} from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { CATALOGO_CATEGORIAS } from '@/domain/catalogo-categorias'

export const metadata = {
  // Absoluto: la plantilla del sitio ciudadano le pegaría el nombre del
  // municipio, y esta página es del producto, no de un municipio.
  title: { absolute: 'DemosVoz · Atención ciudadana con plazos públicos y evidencia' },
  description:
    'Una sola plataforma para recibir, atender y demostrar cada reporte ciudadano. Plazos públicos por tipo de problema, evidencia obligatoria, y el vecino confirma el cierre.',
}
export const dynamic = 'force-dynamic'

/**
 * La página del producto. Habla de lo que la plataforma hace de verdad —
 * cada afirmación corresponde a algo construido y probado— y las capturas
 * son del sistema tal como está.
 */
export default async function Plataforma() {
  const [colonias, dependencias] = await Promise.all([
    prisma.colonia.count(), prisma.dependencia.count({ where: { activa: true } }),
  ])

  return (
    <article className="text-tinta">

      {/* ── Portada ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-14 md:pt-24">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-marca-600 uppercase">Atención ciudadana municipal</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-balance md:text-5xl">
              El municipio que responde, y lo puede demostrar.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-tinta-suave">
              Una sola plataforma para recibir cada reporte de la gente, mandarlo al área que lo
              atiende, cumplir un plazo que se publica, y cerrarlo con foto — solo cuando el vecino
              dice que quedó.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className="btn-principal inline-flex h-12 items-center gap-2 rounded-lg bg-marca-600 px-6 text-base font-medium text-white">
                Ver la demostración <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="https://demoscopiadigital.com/#contacto" className="inline-flex h-12 items-center rounded-lg border border-borde bg-papel px-6 text-base font-medium hover:bg-lienzo">
                Hablar con nosotros
              </a>
            </div>
            <p className="mt-4 text-sm text-tenue">Sin registro para el ciudadano. Un folio, y con él sigue su reporte.</p>
          </div>
          <div className="relative mx-auto w-full max-w-[320px]">
            <Image
              src="/marca/capturas/reportar-movil.jpg" alt="El formulario de reporte en un teléfono"
              width={780} height={1688} priority
              className="rounded-[2rem] border-8 border-tinta shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── El problema ─────────────────────────────────────────────────── */}
      <section id="problema" className="border-y border-borde bg-lienzo">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-bold text-balance">Así se atiende hoy en la mayoría de los municipios</h2>
          <p className="mt-3 max-w-2xl text-tinta-suave">
            No por falta de voluntad: por falta de un sistema. Los reportes llegan por todos lados y
            no viven en ningún lado.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { i: Layers, t: 'Dispersos', d: 'Llegan por teléfono, Facebook, WhatsApp del regidor y ventanilla. Nadie sabe cuántos hay ni cuántos siguen abiertos.' },
              { i: Clock, t: 'Sin plazo', d: '«Lo vamos a atender» no dice cuándo. Sin un compromiso medible, no hay forma de saber si el área cumple.' },
              { i: EyeOff, t: 'Sin evidencia', d: 'Un reporte se cierra porque alguien dijo que ya. La foto del trabajo terminado no existe, o se pierde en un celular.' },
              { i: HelpCircle, t: 'El vecino nunca sabe', d: 'Reportó, y ya. No le avisan si lo asignaron, si fueron, ni si quedó. Vuelve a reportar lo mismo, o deja de reportar.' },
            ].map(({ i: Icono, t, d }) => (
              <div key={t} className="rounded-[--radius-tarjeta] border border-borde bg-papel p-5">
                <Icono className="size-6 text-rojo-600" aria-hidden />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-tinta-suave">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lo que cambia ───────────────────────────────────────────────── */}
      <section id="cambio" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-bold text-balance">Lo que cambia con DemosVoz</h2>
        <p className="mt-3 max-w-2xl text-tinta-suave">
          Cada reporte tiene un dueño, un plazo y una foto. Y todo eso es visible — para el
          ciudadano, para el área y para quien dirige.
        </p>
        <div className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            { i: Route, t: 'Va solo al área correcta', d: 'Cada tipo de problema está ligado a la dependencia que lo atiende. Un bache llega a Obras Públicas; una fuga, al organismo de agua. Sin pasar por nadie.' },
            { i: Clock, t: 'Plazos públicos, medidos', d: 'El municipio fija cuántos días hábiles promete por cada problema. Ese plazo se le dice al ciudadano en su acuse y se mide contra el cumplimiento real en el tablero abierto.' },
            { i: Camera, t: 'Evidencia obligatoria', d: 'La cuadrilla no puede marcar resuelto sin subir la foto del trabajo terminado. El antes y el después quedan en el expediente, y los mejores en una galería pública.' },
            { i: CheckCircle2, t: 'El vecino cierra, no el sistema', d: 'Al resolver, recibe la foto y una pregunta: ¿quedó? Si dice que no, el reporte se reabre con plazo nuevo. Si dice que sí, califica. Un cierre confirmado vale más que uno declarado.' },
            { i: MessageCircle, t: 'Por donde la gente ya habla', d: 'WhatsApp, Telegram, la web o la app instalada en el teléfono. Un asistente entiende el problema escrito con las palabras de la gente y hace las preguntas justas.' },
            { i: Bell, t: 'El personal se entera al instante', d: 'Al titular del área le llega cada reporte nuevo por correo y Telegram; a la cuadrilla, lo que le asignan por WhatsApp. Lo que venció y lo que el vecino reabrió, también.' },
            { i: BarChart3, t: 'Un tablero que cualquiera puede ver', d: 'Cuántos reportes, cuántos a tiempo, cuánto tarda cada área, qué dice la gente. Público, por colonia, con datos abiertos descargables. Es rendición de cuentas en vivo.' },
            { i: CalendarRange, t: 'El informe de la junta del lunes', d: 'Por dependencia y por semana: qué resolvió, si cumplió el plazo, qué trae pendiente y qué lleva más tiempo esperando. Imprimible, con la comparación contra la semana anterior.' },
            { i: ShieldCheck, t: 'Los datos de la gente, protegidos', d: 'Teléfonos cifrados, ninguna página pública expone nombre ni número, ubicación de los datos abiertos redondeada para no señalar una casa. Probado, no prometido.' },
          ].map(({ i: Icono, t, d }) => (
            <div key={t} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-700">
                <Icono className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-tinta-suave">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ───────────────────────────────────────────────── */}
      <section id="como" className="border-y border-borde bg-lienzo">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-bold text-balance">Cómo funciona, de un lado y del otro</h2>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-wide text-marca-600 uppercase">Para el ciudadano</p>
              <ol className="mt-4 space-y-5">
                {[
                  ['Cuenta qué pasa', 'Con sus palabras, por WhatsApp o desde el teléfono. Una foto y la ubicación, y ya. Menos de dos minutos, sin cuenta ni contraseña.'],
                  ['Recibe un folio y una fecha', '«Nos comprometemos a atenderlo a más tardar el 17 de septiembre.» Con el folio ve cómo va y puede agregar más fotos o información.'],
                  ['Confirma que quedó', 'Le llega la foto del trabajo terminado. Si el problema sigue, lo dice y el reporte se reabre. Si quedó, califica del 1 al 5.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-600 text-sm font-semibold text-white">{i + 1}</span>
                    <div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-tinta-suave">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-marca-600 uppercase">Para el municipio</p>
              <ol className="mt-4 space-y-5">
                {[
                  ['Llega clasificado y ruteado', 'El reporte aparece en la bandeja del área que lo atiende, con su plazo corriendo. El titular ya recibió el aviso. Si hay uno igual cerca, se detecta y no se duplica.'],
                  ['La cuadrilla lo atiende con evidencia', 'Desde su teléfono ve lo que le asignaron, marca que empezó, y al terminar sube la foto. Sin foto no hay cierre.'],
                  ['Se mide, se publica, se informa', 'El cumplimiento de cada área va al tablero público y al informe semanal. Lo que se venció avisa solo. Nada depende de que alguien se acuerde.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-white">{i + 1}</span>
                    <div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-tinta-suave">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Antes y después */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[['/marca/escena-antes.jpg', 'Antes', 'Lo que reportó el vecino'], ['/marca/escena-despues.jpg', 'Después', 'La evidencia que subió la cuadrilla']].map(([src, t, d]) => (
              <figure key={t} className="overflow-hidden rounded-[--radius-tarjeta] border border-borde bg-papel">
                <Image src={src!} alt={d!} width={1200} height={900} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="flex items-baseline gap-2 p-3 text-sm"><strong>{t}</strong><span className="text-tinta-suave">{d}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capturas ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-bold text-balance">Lo que ve quien administra</h2>
        <div className="mt-10 space-y-12">
          {[
            { src: '/marca/capturas/bandeja.jpg', t: 'La bandeja', d: 'Todo lo abierto, por área: cuántos, cuántos vencidos, cuántos sin cuadrilla. Filtra por categoría, colonia, dependencia o canal. Cada reporte con su plazo, su asignado y su historia completa.' },
            { src: '/marca/capturas/semanal.jpg', t: 'El informe semanal', d: 'Por dependencia: resueltos, cuántos a tiempo, días promedio, comparación con la semana pasada, y los cinco pendientes que llevan más tiempo esperando. Es el documento de la junta del lunes.' },
            { src: '/marca/capturas/tablero.jpg', t: 'El tablero público', d: 'Lo mismo que ve el director, lo ve cualquier vecino: reportes recibidos y resueltos, cumplimiento de plazos por tipo de problema, calificación de la gente, y un mapa por colonia. Con datos abiertos para descargar.' },
          ].map(({ src, t, d }, i) => (
            <div key={t} className={`grid items-center gap-8 lg:grid-cols-[1fr_1.4fr] ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <h3 className="text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-tinta-suave">{d}</p>
              </div>
              <Image src={src} alt={t} width={1600} height={950} className="rounded-[--radius-tarjeta] border border-borde shadow-lg" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Canales ─────────────────────────────────────────────────────── */}
      <section className="border-y border-borde bg-lienzo">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-bold text-balance">Un solo sistema, por todos los canales</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: MessageCircle, t: 'WhatsApp y Telegram', d: 'Un asistente que entiende «hay un bache enorme frente a la escuela» y pregunta solo lo que falta. Reconoce emergencias y manda al 911 en vez de atenderlas por chat.' },
              { i: Smartphone, t: 'App en el teléfono', d: 'Se instala desde el navegador, con ícono y sin barra. Cámara y GPS integrados. iOS y Android.' },
              { i: Globe, t: 'Sitio web', d: 'Para reportar desde una computadora, consultar un folio o ver cómo va el municipio.' },
              { i: FileSpreadsheet, t: 'Ventanilla y teléfono', d: 'Lo que llega por los canales de siempre lo captura el personal en la misma bandeja. Nada queda fuera del sistema.' },
            ].map(({ i: Icono, t, d }) => (
              <div key={t} className="rounded-[--radius-tarjeta] border border-borde bg-papel p-5">
                <Icono className="size-6 text-marca-600" aria-hidden />
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-tinta-suave">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Implementación ──────────────────────────────────────────────── */}
      <section id="implementacion" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-3xl font-bold text-balance">Un municipio se da de alta en una tarde</h2>
            <p className="mt-3 text-tinta-suave">
              No hay proyecto de meses. Lo que es propio de cada municipio se carga desde pantallas
              de administración; lo demás ya está.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                ['Identidad', 'Nombre, escudo, prefijo de folio, centro del mapa. Cuatro identidades visuales, incluida la del Gobierno de México.'],
                ['Colonias', `Del catálogo nacional de Correos de México: cualquier municipio del país, con códigos postales, en tres clics. (${colonias} cargadas en esta demostración.)`],
                ['Dependencias', `Con titular, teléfono y correo, desde una hoja de Excel. (${dependencias} en esta demostración.)`],
                ['Problemas y plazos', `Un catálogo de ${CATALOGO_CATEGORIAS.length} problemas municipales; se activan con una casilla y cada uno llega con un plazo sugerido que el área ajusta.`],
                ['Personal', 'Cuentas por rol —operador, cuadrilla, supervisor, administración— con su Telegram y WhatsApp para los avisos.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verde-600" aria-hidden />
                  <span><strong>{t}.</strong> <span className="text-tinta-suave">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {[
              { i: Database, t: 'Los datos se quedan en México', d: 'Se instala en un servidor en el país, con respaldo diario de la base y de las fotos. Los teléfonos de la gente van cifrados; ninguna página pública expone nombre ni número.' },
              { i: ShieldCheck, t: 'Transparencia de origen', d: 'Los plazos son públicos. El cumplimiento es público. Los datos abiertos se descargan sin pedir permiso. Un municipio que usa DemosVoz está diciendo que se deja medir.' },
              { i: XCircle, t: 'Lo que no hace', d: 'No atiende emergencias por chat: las detecta y manda al 911. No recibe casos personales —violencia, adicciones— que no deben estar en un mapa público. No es un buzón de quejas: cada reporte tiene un área, un plazo y un cierre.' },
            ].map(({ i: Icono, t, d }) => (
              <div key={t} className="rounded-[--radius-tarjeta] border border-borde bg-papel p-5">
                <div className="flex items-center gap-2">
                  <Icono className="size-5 text-marca-600" aria-hidden />
                  <h3 className="font-semibold">{t}</h3>
                </div>
                <p className="mt-2 text-sm text-tinta-suave">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────────────── */}
      <section className="border-t border-borde">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="text-3xl font-bold text-balance">Véala funcionando con datos de un municipio real</h2>
          <p className="mx-auto mt-3 max-w-xl text-tinta-suave">
            La demostración está configurada como Tula de Allende, Hidalgo, con sus colonias y sus
            dependencias reales. Entre, reporte, y sígalo hasta el cierre.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-principal inline-flex h-12 items-center gap-2 rounded-lg bg-marca-600 px-6 text-base font-medium text-white">
              Ver la demostración <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a href="https://demoscopiadigital.com/#contacto" className="inline-flex h-12 items-center rounded-lg border border-borde bg-papel px-6 text-base font-medium hover:bg-lienzo">
              Hablar con nosotros
            </a>
          </div>
        </div>
      </section>
    </article>
  )
}
