import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Inbox, Star } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { reportesDeColonia, type PeriodoColonias } from '@/application/informe-colonias'
import { ESTATUS, PRIORIDAD } from '@/domain/presentacion'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import { fecha, haceCuanto, numero } from '@/domain/formato'
import { Tarjeta } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { SelloDependencia } from '@/components/sello-dependencia'
import { IconoCategoria } from '@/components/icono-categoria'

export const metadata = { title: 'Colonia' }
export const dynamic = 'force-dynamic'

/** Todo lo de una colonia: lo abierto (vencidos hasta arriba) y lo que ya se atendió en el periodo. */
export default async function Colonia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const usuario = await requerirRol('supervisor', 'admin')
  const { id } = await params
  const sp = await searchParams
  const periodo = ([30, 90, 365].find((p) => String(p) === sp.periodo) ?? 90) as PeriodoColonias
  const coloniaId = Number(id)
  if (!Number.isInteger(coloniaId)) notFound()

  const colonia = await prisma.colonia.findUnique({ where: { id: coloniaId }, select: { id: true, slug: true, nombre: true, tipo: true, codigoPostal: true } })
  if (!colonia) notFound()

  const alcance = usuario.rol === 'supervisor' ? usuario.dependenciaId ?? null : null
  const reportes = await reportesDeColonia(coloniaId, alcance, periodo)
  const ahora = new Date()
  const abiertos = reportes.filter((r) => (ESTATUS_ABIERTOS as string[]).includes(r.estatus))
  const atendidos = reportes.filter((r) => !(ESTATUS_ABIERTOS as string[]).includes(r.estatus))
  const vencidos = abiertos.filter((r) => r.fechaLimite < ahora).length

  const Fila = ({ r }: { r: (typeof reportes)[number] }) => {
    const abierto = (ESTATUS_ABIERTOS as string[]).includes(r.estatus)
    const vencido = abierto && r.fechaLimite < ahora
    return (
      <tr className={vencido ? 'bg-rojo-50/40' : undefined}>
        <td className="px-4 py-2.5 align-top whitespace-nowrap">
          <Link href={`/bandeja/${r.folio}`} className="font-mono text-marca-700 underline">{r.folio}</Link>
          {r.prioridad !== 'normal' && <div className="mt-1"><Insignia tono={PRIORIDAD[r.prioridad].tono}>{PRIORIDAD[r.prioridad].texto}</Insignia></div>}
        </td>
        <td className="max-w-md px-4 py-2.5 align-top">
          <p className="flex items-center gap-1.5 font-medium"><IconoCategoria nombre={r.categoria.icono} className="size-4 text-tinta-suave" />{r.categoria.nombre}</p>
          <p className="truncate text-xs text-tinta-suave">{r.descripcion}</p>
          <p className="text-xs text-tenue">{r.direccionTexto ?? 'Sin dirección'} · {haceCuanto(r.createdAt)}{r._count.adhesiones > 0 && ` · ${r._count.adhesiones} vecinos`}</p>
        </td>
        <td className="px-4 py-2.5 align-top"><Insignia tono={ESTATUS[r.estatus].tono}>{ESTATUS[r.estatus].interno}</Insignia>{r.vecesReabierto > 0 && <p className="mt-1 text-xs text-ambar-600">reabierto</p>}</td>
        <td className="px-4 py-2.5 align-top">
          <span className="flex items-center gap-1.5 text-xs"><SelloDependencia dependencia={r.dependencia} /><span className="max-w-40 truncate">{r.dependencia.nombre}</span></span>
          <p className="text-xs text-tinta-suave">{r.asignadoA?.nombre ?? (abierto ? 'Sin asignar' : '')}</p>
        </td>
        <td className="px-4 py-2.5 align-top whitespace-nowrap text-xs">
          {abierto
            ? vencido ? <Insignia tono="rojo">venció {fecha(r.fechaLimite)}</Insignia> : <>vence {fecha(r.fechaLimite)}</>
            : r.resueltoAt
              ? <>{r.resueltoAt <= r.fechaLimite ? <Insignia tono="verde">a tiempo</Insignia> : <Insignia tono="rojo">tarde</Insignia>} {fecha(r.resueltoAt)}
                  {r.calificacion && <span className="ml-1 inline-flex items-center gap-0.5"><Star className="size-3 fill-ambar-500 text-ambar-500" aria-hidden />{r.calificacion}</span>}</>
              : <span className="text-tenue">{fecha(r.cerradoAt ?? r.createdAt)}</span>}
        </td>
      </tr>
    )
  }

  const Tabla = ({ filas }: { filas: typeof reportes }) => (
    <Tarjeta className="overflow-hidden"><div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
          <tr>
            <th className="px-4 py-2.5 font-medium">Folio</th>
            <th className="px-4 py-2.5 font-medium">Reporte</th>
            <th className="px-4 py-2.5 font-medium">Estatus</th>
            <th className="px-4 py-2.5 font-medium">Área · quién</th>
            <th className="px-4 py-2.5 font-medium">Plazo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">{filas.map((r) => <Fila key={r.id} r={r} />)}</tbody>
      </table>
    </div></Tarjeta>
  )

  return (
    <div className="space-y-6">
      <Link href={`/ejecutivo/colonias?periodo=${periodo}`} className="inline-flex items-center gap-1 text-sm text-marca-700 underline"><ArrowLeft className="size-4" aria-hidden />Todas las colonias</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-marca-700 uppercase">{colonia.tipo ?? 'Colonia'}{colonia.codigoPostal ? ` · CP ${colonia.codigoPostal}` : ''}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{colonia.nombre}</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {numero(abiertos.length)} abiertos{vencidos > 0 && <>, <span className="font-medium text-rojo-600">{numero(vencidos)} vencidos</span></>} · {numero(atendidos.length)} atendidos en el periodo{alcance ? ' · solo tu área' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/bandeja?colonia=${colonia.id}&estatus=abiertos`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-borde px-3 text-sm font-medium hover:bg-lienzo"><Inbox className="size-4" aria-hidden />Abrir en la bandeja</Link>
          <Link href={`/mi-colonia/${colonia.slug}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-borde px-3 text-sm font-medium hover:bg-lienzo"><ExternalLink className="size-4" aria-hidden />Lo que ve el vecino</Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pendientes</h2>
        {abiertos.length === 0 ? <Alerta tipo="exito">Nada abierto en esta colonia.</Alerta> : <Tabla filas={abiertos} />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Atendidos en el periodo</h2>
        {atendidos.length === 0 ? <p className="text-sm text-tinta-suave">Nada resuelto, cerrado ni descartado en el periodo.</p> : <Tabla filas={atendidos} />}
      </section>
    </div>
  )
}
