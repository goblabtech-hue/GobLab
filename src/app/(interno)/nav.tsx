'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/domain/formato'

export function NavInterna({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname()

  return (
    <nav aria-label="Secciones internas" className="min-w-0 flex-1">
      <ul className="flex gap-1 overflow-x-auto">
        {enlaces.map((e) => {
          const activo = ruta === e.href || ruta.startsWith(`${e.href}/`)
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'cabecera-enlace inline-flex h-9 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-colors',
                  activo && 'cabecera-activo font-medium',
                )}
              >
                {e.texto}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
