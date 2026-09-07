import type { Prisma } from '@/generated/prisma/client'
import type { TipoEvento } from '@/generated/prisma/enums'

/**
 * Piezas compartidas por todos los casos de uso del reporte.
 *
 * `registrarEvento` está aquí y no en cada módulo porque la bitácora es la
 * única fuente de los KPIs de reasignación y reapertura: si cada transición
 * escribiera su evento a mano, tarde o temprano una se olvidaría.
 */

/** Una regla del dominio que el usuario puede corregir; su mensaje se le muestra. */
export class ReglaDeNegocio extends Error {}

export type NuevoEvento = {
  reporteId: string
  tipo: TipoEvento
  detalle?: Prisma.InputJsonValue
  userId?: string | null
}

export async function registrarEvento(
  tx: Prisma.TransactionClient,
  evento: NuevoEvento,
) {
  await tx.eventoReporte.create({
    data: {
      reporteId: evento.reporteId,
      tipo: evento.tipo,
      detalle: evento.detalle ?? {},
      userId: evento.userId ?? null,
    },
  })
}
