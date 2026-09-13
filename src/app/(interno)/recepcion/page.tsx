import { Inbox } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { porValidar } from '@/application/reportes'
import { Alerta } from '@/components/ui/alerta'
import { TarjetaRecepcion } from './tarjeta'

export const metadata = { title: 'Recepción' }
export const dynamic = 'force-dynamic'

/**
 * Recepción: todo lo que manda la gente pasa por aquí antes de existir para
 * el municipio. Una persona lo lee, ve las fotos, y decide si se registra.
 * Sin filtros automáticos: la decisión es humana y queda con su nombre.
 */
export default async function Recepcion() {
  await requerirRol('operador', 'supervisor', 'admin')
  const [pendientes, categorias] = await Promise.all([
    porValidar(),
    prisma.categoria.findMany({ where: { activa: true }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true } }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Inbox className="size-5 text-marca-600" aria-hidden />
          Recepción
          {pendientes.length > 0 && <span className="rounded-full bg-marca-600 px-2 py-0.5 text-xs font-semibold text-white">{pendientes.length}</span>}
        </h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Lo que la gente acaba de mandar. Nada de esto es todavía del área ni es público: se
          registra cuando tú lo decidas. Si el problema es real pero el texto o las fotos no se
          pueden mostrar, regístralo marcando «no mostrar al público».
        </p>
      </div>

      {pendientes.length === 0 ? (
        <Alerta tipo="info">No hay reportes esperando. Todo lo que ha llegado ya se validó.</Alerta>
      ) : (
        <div className="space-y-4">
          {pendientes.map((r) => <TarjetaRecepcion key={r.id} r={r} categorias={categorias} />)}
        </div>
      )}
    </div>
  )
}
