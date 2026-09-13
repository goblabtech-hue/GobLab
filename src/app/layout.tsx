import type { Metadata, Viewport } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { TEMAS, variablesDeTema } from '@/domain/temas'
import { AppNativa } from '@/components/app-nativa'
import './globals.css'

// Las dos se cargan siempre; el tema elige cuál usa a través de
// --fuente-tema (ver src/domain/temas.ts). Cargar una fuente no la muestra:
// solo la deja disponible.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const montserrat = Montserrat({ variable: '--font-montserrat', subsets: ['latin'], display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const { nombre } = await obtenerConfiguracion()
  return {
    title: { default: `Atención Ciudadana · ${nombre}`, template: `%s · ${nombre}` },
    description:
      'Reporta un problema de tu colonia, dale seguimiento con tu folio y consulta cómo vamos, en tiempo real.',
    // iOS no lee el manifest para esto: el ícono de inicio y el modo app se
    // declaran aparte.
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DemosVoz' },
    icons: { apple: '/marca/apple-touch-icon.png', icon: '/marca/icono-192.png' },
    // robots.txt le pide al buscador que no entre; esto se lo pide a la página
    // ya indexada que la saque. Hacen falta los dos: el primero no deshace lo
    // que un buscador ya guardó.
    ...(process.env.MODO_DEMO === 'true'
      ? { robots: { index: false, follow: false } }
      : {}),
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { tema } = await obtenerConfiguracion()
  return {
    width: 'device-width',
    initialScale: 1,
    // El color de la barra del navegador en el celular sigue a la identidad.
    themeColor: TEMAS[tema].cabecera.fondo,
  }
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const { tema } = await obtenerConfiguracion()
  return (
    // Los tokens del tema van como variables en <html>: así Tailwind y todo
    // lo que use `var(--color-…)` cambia de identidad sin recompilar nada.
    <html
      lang="es-MX"
      data-tema={tema}
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
      style={variablesDeTema(tema) as React.CSSProperties}
    >
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="salto-contenido">Saltar al contenido</a>
        <AppNativa />
        {children}
      </body>
    </html>
  )
}
