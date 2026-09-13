import Link from 'next/link'
import { BookOpen, Check, Minus } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { DiagramaFlujo } from '@/app/(marketing)/plataforma/diagrama-flujo'
import { MANUALES, MATRIZ } from './contenido'
import { Imprimir } from './imprimir'

export const metadata = { title: 'Manuales de operación' }

const COLUMNAS = [
  ['ciudadano', 'Ciudadano'], ['operador', 'Atención'], ['cuadrilla', 'Cuadrilla'], ['supervisor', 'Supervisión'], ['admin', 'Admin.'],
] as const

/**
 * Cómo se opera la plataforma, por perfil. Vive dentro de administración
 * porque es quien da de alta a la gente y le explica qué le toca; pero cada
 * manual está escrito para la persona que lo va a usar, no para sistemas.
 */
export default async function Manuales() {
  await requerirRol('admin')

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="size-5 text-marca-600" aria-hidden />
            Manuales de operación
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Cómo funciona la plataforma y qué le toca a cada quien. Describe la versión instalada:
            cada pantalla y botón que se menciona existe tal cual. Se puede imprimir completo o
            mandar a cada persona la sección de su perfil.
          </p>
        </div>
        <Imprimir />
      </div>

      {/* índice */}
      <nav aria-label="Perfiles" className="print:hidden">
        <ul className="flex flex-wrap gap-2">
          <li><a href="#flujo" className="inline-flex h-9 items-center rounded-lg border border-borde bg-papel px-3 text-sm hover:border-marca-300">Cómo opera</a></li>
          {MANUALES.map((m) => (
            <li key={m.id}><a href={`#${m.id}`} className="inline-flex h-9 items-center rounded-lg border border-borde bg-papel px-3 text-sm hover:border-marca-300">{m.perfil}</a></li>
          ))}
          <li><a href="#permisos" className="inline-flex h-9 items-center rounded-lg border border-borde bg-papel px-3 text-sm hover:border-marca-300">Quién puede qué</a></li>
        </ul>
      </nav>

      {/* cómo opera */}
      <section id="flujo" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold">Cómo opera la plataforma</h2>
        <p className="max-w-3xl text-sm text-tinta-suave">
          Un reporte recorre siete pasos y dos decisiones que toman personas: recepción decide si
          se registra; el vecino decide si quedó resuelto. Nada llega al área ni al público sin
          que alguien lo haya leído, y nada se cierra sin foto y sin la palabra de quien reportó.
          Los plazos son públicos por categoría y se miden solos; si uno vence, el área recibe
          la alerta sin pedirla.
        </p>
        <Tarjeta><TarjetaCuerpo><DiagramaFlujo /></TarjetaCuerpo></Tarjeta>
      </section>

      {/* un manual por perfil */}
      {MANUALES.map((m) => (
        <section key={m.id} id={m.id} className="scroll-mt-20 break-before-page space-y-5">
          <div className="border-b border-borde pb-3">
            <h2 className="text-lg font-semibold">{m.perfil}</h2>
            <p className="mt-1 max-w-3xl text-sm text-tinta-suave">{m.quien}</p>
            <p className="mt-1 text-sm"><span className="font-medium">Entra por:</span> <span className="text-tinta-suave">{m.entra}</span></p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-5">
              {m.tareas.map((t) => (
                <div key={t.titulo}>
                  <h3 className="font-semibold">{t.titulo}</h3>
                  <ol className="mt-2 space-y-1.5 text-sm">
                    {t.pasos.map((p, i) => (
                      <li key={p} className="flex gap-3">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-marca-600 text-[11px] font-bold text-white tabular-nums">{i + 1}</span>
                        <span className="text-tinta-suave">{p}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="space-y-4 text-sm">
              <Tarjeta><TarjetaCuerpo>
                <h3 className="font-semibold">Avisos que recibe</h3>
                <ul className="mt-2 space-y-1.5 text-tinta-suave">
                  {m.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </TarjetaCuerpo></Tarjeta>
              <Tarjeta><TarjetaCuerpo>
                <h3 className="font-semibold">Puede</h3>
                <ul className="mt-2 space-y-1.5">
                  {m.puede.map((p) => (
                    <li key={p} className="flex gap-2 text-tinta-suave"><Check className="mt-0.5 size-4 shrink-0 text-marca-600" aria-hidden />{p}</li>
                  ))}
                </ul>
                <h3 className="mt-4 font-semibold">No puede</h3>
                <ul className="mt-2 space-y-1.5">
                  {m.noPuede.map((p) => (
                    <li key={p} className="flex gap-2 text-tinta-suave"><Minus className="mt-0.5 size-4 shrink-0 text-tenue" aria-hidden />{p}</li>
                  ))}
                </ul>
              </TarjetaCuerpo></Tarjeta>
            </div>
          </div>
        </section>
      ))}

      {/* matriz */}
      <section id="permisos" className="scroll-mt-20 break-before-page space-y-4">
        <h2 className="text-lg font-semibold">Quién puede qué</h2>
        <p className="max-w-3xl text-sm text-tinta-suave">
          «Área» significa solo en su dependencia. Los perfiles se asignan en{' '}
          <Link href="/admin/usuarios" className="underline">Usuarios</Link>; una cuenta de supervisión sin dependencia ve todas las áreas.
        </p>
        <div className="overflow-x-auto rounded-xl border border-borde bg-papel">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Función</th>
                {COLUMNAS.map(([, t]) => <th key={t} className="px-3 py-2.5 font-medium">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIZ.map((f) => (
                <tr key={f.funcion} className="border-t border-borde">
                  <td className="px-4 py-2 font-medium">{f.funcion}</td>
                  {COLUMNAS.map(([k]) => {
                    const v = f[k]
                    return (
                      <td key={k} className={`px-3 py-2 ${v ? 'text-tinta' : 'text-tenue'}`}>
                        {v === '' ? '—' : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
