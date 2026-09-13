import Link from 'next/link'
import { Megaphone, Search, BarChart3, Phone, Sparkles } from 'lucide-react'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { AvisoDemo } from '@/components/aviso-demo'
import { Logotipo } from '@/components/logotipo'
import { InstalarApp } from '@/components/instalar-app'

const ENLACES = [
  { href: '/reportar', texto: 'Reportar', icono: Megaphone },
  { href: '/folio', texto: 'Mi folio', icono: Search },
  { href: '/tablero', texto: 'Cómo vamos', icono: BarChart3 },
]

// Solo en la instancia de demostración: un vecino de un municipio real no
// debe ver «Ventas» en el sitio de su ayuntamiento.
const ENLACES_DEMO = [
  { href: '/plataforma', texto: 'La plataforma', icono: Sparkles },
  { href: '/contacto', texto: 'Contacto', icono: Phone },
]

export default async function LayoutPublico({ children }: { children: React.ReactNode }) {
  const municipio = await obtenerConfiguracion()

  return (
    <div className="flex min-h-full flex-col">
      <AvisoDemo municipio={municipio.nombre} />

      <header className="cabecera sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/inicio" className="mr-auto flex min-w-0 items-center" aria-label="Inicio">
            <Logotipo tema={municipio.tema} municipio={municipio.nombre} logoUrl={municipio.logoUrl} logoBlancoUrl={municipio.logoBlancoUrl} />
          </Link>
          <nav aria-label="Principal">
            <ul className="flex items-center gap-1">
              {[...ENLACES, ...(process.env.MODO_DEMO === 'true' ? ENLACES_DEMO : [])].map(({ href, texto, icono: Icono }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="cabecera-enlace inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm sm:px-3"
                  >
                    <Icono className="size-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="contenido" className="flex-1">{children}</main>

      <InstalarApp />

      <footer className="mt-12 border-t border-borde bg-papel">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-sm text-tinta-suave">
          <div className="flex items-start gap-2.5 rounded-lg bg-rojo-50 p-3 text-rojo-600">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong>¿Es una emergencia?</strong> No uses esta página. Llama al{' '}
              <a href={`tel:${municipio.telEmergencias}`} className="font-semibold underline">
                {municipio.telEmergencias}
              </a>
              . Fugas grandes, incendios, accidentes y situaciones de riesgo se atienden por teléfono.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{municipio.nombre} · Atención Ciudadana</p>
            <nav aria-label="Legal" className="flex gap-4">
              <Link href="/privacidad" className="underline hover:text-tinta">Aviso de privacidad</Link>
              <Link href="/datos-abiertos" className="underline hover:text-tinta">Datos abiertos</Link>
              <Link href="/entrar" className="underline hover:text-tinta">Personal municipal</Link>
              <Link href="/plataforma" className="underline hover:text-tinta">Qué es DemosVoz</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
