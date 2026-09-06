import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Inbox, Wrench, BarChart3, Settings, LogOut, Images } from 'lucide-react'
import { auth } from '@/lib/auth'
import { RUTAS_PROTEGIDAS } from '@/lib/auth.config'
import { ROL } from '@/lib/presentacion'
import { municipioPublico } from '@/lib/config'
import { Boton } from '@/components/ui/boton'
import { salir } from '@/app/entrar/acciones'
import { NavInterna } from './nav'

const ENLACES = [
  { href: '/bandeja', texto: 'Bandeja', icono: Inbox },
  { href: '/cuadrilla', texto: 'Mis reportes', icono: Wrench },
  { href: '/ejecutivo', texto: 'Indicadores', icono: BarChart3 },
  { href: '/moderacion', texto: 'Galería', icono: Images },
  { href: '/admin', texto: 'Administración', icono: Settings },
]

export default async function LayoutInterno({ children }: LayoutProps<'/'>) {
  const sesion = await auth()
  if (!sesion?.user) redirect('/entrar')
  const { rol, name } = sesion.user

  const permitidos = ENLACES.filter((e) => {
    const regla = RUTAS_PROTEGIDAS.find((r) => r.prefijo === e.href)
    return !regla || regla.roles.includes(rol)
  })

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-borde bg-papel">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="shrink-0 text-sm font-semibold text-marca-700">
            {municipioPublico.nombre}
          </Link>

          <NavInterna enlaces={permitidos.map(({ href, texto }) => ({ href, texto }))} />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{name}</p>
              <p className="text-xs leading-tight text-tinta-suave">{ROL[rol] ?? rol}</p>
            </div>
            <form action={salir}>
              <Boton variante="fantasma" tamano="icono" type="submit" title="Salir">
                <LogOut aria-hidden />
                <span className="sr-only">Salir</span>
              </Boton>
            </form>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  )
}
