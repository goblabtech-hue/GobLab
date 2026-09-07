'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requerirRol, NoAutorizado } from '@/lib/auth'

export type Resultado = { ok?: boolean; error?: string; categoriaId?: number }

const schema = z.object({
  categoriaId: z.coerce.number().int(),
  slaDiasHabiles: z.coerce.number().int()
    .min(1, 'El plazo mínimo es 1 día hábil.')
    .max(60, 'Un plazo de más de 60 días hábiles no es una promesa creíble.'),
})

/**
 * Cambia el plazo comprometido de una categoría.
 *
 * Solo afecta a los reportes que se levanten a partir de ahora: cada reporte
 * guarda el plazo que se le prometió. Si no fuera así, bajar un plazo haría
 * que reportes ya resueltos aparecieran de golpe como incumplidos en el tablero
 * público — y ese tablero es un compromiso con la gente, no un tablero interno
 * que se pueda reescribir.
 */
export async function cambiarPlazo(
  _previo: Resultado, datos: FormData,
): Promise<Resultado> {
  try {
    await requerirRol('admin')

    const parsed = schema.safeParse({
      categoriaId: datos.get('categoriaId'),
      slaDiasHabiles: datos.get('slaDiasHabiles'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    await prisma.categoria.update({
      where: { id: parsed.data.categoriaId },
      data: { slaDiasHabiles: parsed.data.slaDiasHabiles },
    })

    revalidatePath('/admin/plazos')
    revalidatePath('/admin/categorias')
    revalidatePath('/tablero')
    return { ok: true, categoriaId: parsed.data.categoriaId }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'Solo administración puede cambiar los plazos.' }
    throw e
  }
}
