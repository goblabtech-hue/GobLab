'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SelectorColonia({
  colonias,
}: { colonias: { slug: string; nombre: string }[] }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')

  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <label htmlFor="colonia-tablero" className="sr-only">Elige tu colonia</label>
      <select
        id="colonia-tablero" value={slug}
        onChange={(e) => {
          setSlug(e.target.value)
          if (e.target.value) router.push(`/mi-colonia/${e.target.value}`)
        }}
        className="h-11 min-w-0 flex-1 rounded-lg border border-borde bg-papel px-3 text-base sm:w-56"
      >
        <option value="">Elige tu colonia…</option>
        {colonias.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
      </select>
    </div>
  )
}
