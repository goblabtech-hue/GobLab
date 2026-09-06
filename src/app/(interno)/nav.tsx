'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

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
                  'inline-flex h-9 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-colors',
                  activo
                    ? 'bg-marca-50 font-medium text-marca-700'
                    : 'text-tinta-suave hover:bg-lienzo hover:text-tinta',
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
