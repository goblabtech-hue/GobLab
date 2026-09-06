import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { municipioPublico } from '@/lib/config'
import './globals.css'

const inter = Inter({ variable: '--font-sans-app', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: `Atención Ciudadana · ${municipioPublico.nombre}`,
    template: `%s · ${municipioPublico.nombre}`,
  },
  description:
    'Reporta un problema de tu colonia, dale seguimiento con tu folio y consulta cómo vamos, en tiempo real.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d8465',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-MX" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="salto-contenido">Saltar al contenido</a>
        {children}
      </body>
    </html>
  )
}
