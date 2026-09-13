import Link from 'next/link'
import { Phone, MessageCircle, Mail, Clock, ArrowRight, CalendarCheck, Building2, Users } from 'lucide-react'
import { contactoVentas } from '@/infrastructure/config'

export const metadata = {
  title: { absolute: 'Contacto y ventas · DemosVoz' },
  description: 'Habla con el equipo de DemosVoz para llevar la plataforma de atención ciudadana a tu municipio.',
}
export const dynamic = 'force-dynamic'

/** Formato para leer: 773 123 4567. */
function telefonoLegible(t: string): string {
  const d = t.replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  if (d.length === 12 && d.startsWith('52')) return `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  return t
}

export default function Contacto() {
  const v = contactoVentas()
  const hayCanal = v.telefono || v.whatsapp || v.correo

  return (
    <article className="text-tinta">
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-12 md:pt-24">
        <p className="text-sm font-semibold tracking-wide text-marca-600 uppercase">Contacto y ventas</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-balance md:text-5xl">
          Hablemos de cómo se atienden los reportes en tu municipio.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-tinta-suave">
          Una llamada de veinte minutos alcanza para ver la plataforma funcionando con datos de un
          municipio real y saber qué haría falta para arrancar en el tuyo.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Canales */}
          <div className="space-y-4">
            {v.telefono && (
              <a href={`tel:${v.telefono.replace(/\D/g, '')}`} className="flex items-center gap-4 rounded-[--radius-tarjeta] border border-borde bg-papel p-5 transition-colors hover:border-marca-600">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-700"><Phone className="size-5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-sm text-tinta-suave">Llámanos</p>
                  <p className="text-2xl font-semibold tabular-nums">{telefonoLegible(v.telefono)}</p>
                </div>
                <ArrowRight className="ml-auto size-5 shrink-0 text-tenue" aria-hidden />
              </a>
            )}
            {v.whatsapp && (
              <a href={`https://wa.me/${v.whatsapp}?text=${encodeURIComponent('Hola, quiero saber más de DemosVoz para mi municipio.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-[--radius-tarjeta] border border-borde bg-papel p-5 transition-colors hover:border-marca-600">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-verde-50 text-verde-600"><MessageCircle className="size-5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-sm text-tinta-suave">Escríbenos por WhatsApp</p>
                  <p className="text-2xl font-semibold tabular-nums">{telefonoLegible(v.whatsapp)}</p>
                </div>
                <ArrowRight className="ml-auto size-5 shrink-0 text-tenue" aria-hidden />
              </a>
            )}
            {v.correo && (
              <a href={`mailto:${v.correo}?subject=${encodeURIComponent('DemosVoz para mi municipio')}`} className="flex items-center gap-4 rounded-[--radius-tarjeta] border border-borde bg-papel p-5 transition-colors hover:border-marca-600">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-marca-700"><Mail className="size-5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-sm text-tinta-suave">Por correo</p>
                  <p className="truncate text-xl font-semibold">{v.correo}</p>
                </div>
                <ArrowRight className="ml-auto size-5 shrink-0 text-tenue" aria-hidden />
              </a>
            )}
            {hayCanal && (
              <p className="flex items-center gap-2 px-1 text-sm text-tinta-suave">
                <Clock className="size-4" aria-hidden /> {v.horario}
              </p>
            )}
            {!hayCanal && (
              <div className="rounded-[--radius-tarjeta] border border-dashed border-borde p-5 text-sm text-tinta-suave">
                Los datos de contacto se configuran en el servidor (<code>VENTAS_TELEFONO</code>, <code>VENTAS_WHATSAPP</code>, <code>VENTAS_CORREO</code>). Mientras tanto, la demostración está en{' '}
                <Link href="/inicio" className="underline">/inicio</Link>.
              </div>
            )}
          </div>

          {/* Qué pasa después */}
          <div className="rounded-[--radius-tarjeta] border border-borde bg-lienzo p-6">
            <h2 className="font-semibold">Qué pasa cuando nos llamas</h2>
            <ol className="mt-4 space-y-4">
              {[
                { i: CalendarCheck, t: 'Una demostración con tus datos', d: 'Cargamos las colonias reales de tu municipio —salen del catálogo de Correos de México— y tus dependencias. Ves la plataforma como se vería en tu ayuntamiento, no un genérico.' },
                { i: Building2, t: 'Un plan de arranque de una tarde', d: 'Identidad, colonias, dependencias, plazos y cuentas del personal. No hay proyecto de meses ni migración: lo que hoy está en cuadernos y chats empieza a entrar al sistema el mismo día.' },
                { i: Users, t: 'Acompañamiento con el personal', d: 'Operadores, cuadrillas y directores aprenden en su propio teléfono. La curva es corta porque cada pantalla dice qué hacer y por qué.' },
              ].map(({ i: Icono, t, d }, n) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-600 text-sm font-semibold text-white">{n + 1}</span>
                  <div>
                    <h3 className="flex items-center gap-2 font-medium"><Icono className="size-4 text-marca-600" aria-hidden />{t}</h3>
                    <p className="mt-1 text-sm text-tinta-suave">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/plataforma" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-marca-700 underline-offset-2 hover:underline">
              Ver qué hace la plataforma <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </article>
  )
}
