import Link from 'next/link'
import { Tags, Building2, MapPin, CalendarDays, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'

export const metadata = { title: 'Administración' }

export default async function PaginaAdmin() {
  const [categorias, dependencias, colonias, festivos, usuarios] = await Promise.all([
    prisma.categoria.count(),
    prisma.dependencia.count(),
    prisma.colonia.count(),
    prisma.diaFestivo.count(),
    prisma.usuario.count(),
  ])

  const secciones = [
    { href: '/admin/categorias', icono: Tags, titulo: 'Categorías y promesas de servicio', cuenta: categorias,
      texto: 'Los tipos de problema que puede reportar la gente y el plazo en días hábiles que el municipio se compromete a cumplir.' },
    { href: '/admin/dependencias', icono: Building2, titulo: 'Dependencias', cuenta: dependencias,
      texto: 'Las áreas que resuelven los reportes. Cada categoría se asigna automáticamente a una.' },
    { href: '/admin/colonias', icono: MapPin, titulo: 'Colonias', cuenta: colonias,
      texto: 'El catálogo que alimenta el módulo "Mi colonia" y el respaldo cuando no hay ubicación GPS.' },
    { href: '/admin/festivos', icono: CalendarDays, titulo: 'Días festivos', cuenta: festivos,
      texto: 'Días que no cuentan para el plazo de atención. Afecta directo a la fecha límite de cada reporte.' },
    { href: '/admin/usuarios', icono: Users, titulo: 'Usuarios', cuenta: usuarios,
      texto: 'Cuentas del personal municipal y el perfil con el que entra cada quien.' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administración</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Lo que se configura aquí cambia el comportamiento del sistema en vivo:
          las promesas de servicio y los días festivos recalculan las fechas
          límite de los reportes nuevos.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {secciones.map(({ href, icono: Icono, titulo, texto, cuenta }) => (
          <li key={href}>
            <Link href={href} className="block h-full">
              <Tarjeta className="h-full transition-colors hover:border-marca-200 hover:bg-marca-50/40">
                <TarjetaCuerpo className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-marca-700">
                    <Icono className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {titulo}
                      <span className="ml-2 text-sm font-normal text-tenue">{cuenta}</span>
                    </p>
                    <p className="mt-1 text-sm text-tinta-suave">{texto}</p>
                  </div>
                </TarjetaCuerpo>
              </Tarjeta>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
