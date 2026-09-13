import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { Logotipo } from '@/components/logotipo'

/**
 * Layout de la página de producto.
 *
 * Distinto del sitio ciudadano a propósito: sin el aviso de demostración y
 * sin el menú de reportar. Quien lee esta página es quien decide comprar,
 * no un vecino con un bache.
 */
export default async function LayoutMarketing({ children }: { children: React.ReactNode }) {
  const municipio = await obtenerConfiguracion()
  return (
    <div className="flex min-h-full flex-col">
      {/* Cuatro secciones y una acción. Siete enlaces de dos palabras se
          partían en dos renglones y el botón también; un menú que no cabe en
          una línea no es un menú. Las secciones que no están aquí siguen en
          la página, una tras otra: el menú es un atajo, no un índice. */}
      <header className="cabecera sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/plataforma" className="flex shrink-0 items-center" aria-label="DemosVoz">
            <Logotipo tema={municipio.tema} municipio="DemosVoz" alto={34} />
          </Link>
          <nav aria-label="Secciones" className="hidden items-center gap-1 lg:flex">
            {[
              ['/plataforma#flujo', 'Cómo funciona'],
              ['/plataforma#cambio', 'Lo que cambia'],
              ['/plataforma#informe', 'El informe'],
              ['/plataforma#whatsapp', 'WhatsApp'],
            ].map(([href, texto]) => (
              <a key={href} href={href} className="cabecera-enlace rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap">{texto}</a>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/inicio"
              className="btn-principal inline-flex h-10 items-center gap-1.5 rounded-lg bg-marca-600 px-4 text-sm font-semibold whitespace-nowrap text-white"
            >
              Ver la demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-borde bg-papel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-tinta-suave">
          <p>DemosVoz · una plataforma de <a href="https://demoscopiadigital.com" className="underline">Demoscopia Digital</a></p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacidad" className="underline">Aviso de privacidad</Link>
            <Link href="/datos-abiertos" className="underline">Datos abiertos</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
