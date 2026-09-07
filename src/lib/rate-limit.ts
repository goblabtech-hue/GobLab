import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

/**
 * Límite de peticiones para lo que puede hacer un anónimo (SPEC §7).
 *
 * El contador vive en Postgres, no en memoria del proceso: en cuanto hay dos
 * instancias —o funciones sin estado— un contador local deja de limitar nada.
 * El UPSERT reinicia la ventana o incrementa en una sola sentencia atómica,
 * así que dos peticiones simultáneas no se pisan.
 */

/** IP del cliente según las cabeceras del proxy. */
async function ipCliente(): Promise<string> {
  const h = await headers()
  const reenviada = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return reenviada || h.get('x-real-ip') || 'desconocida'
}

/**
 * @param accion    etiqueta de lo que se limita, p. ej. "reporte-web"
 * @param maximo    peticiones permitidas por ventana
 * @param segundos  duración de la ventana
 * @returns true si se puede continuar
 */
export async function limitar(
  accion: string,
  maximo: number,
  segundos: number,
): Promise<boolean> {
  const clave = `${accion}:${await ipCliente()}`

  const filas = await prisma.$queryRaw<{ cuenta: number }[]>`
    INSERT INTO "LimitePeticion" ("clave", "ventanaAt", "cuenta")
    VALUES (${clave}, now(), 1)
    ON CONFLICT ("clave") DO UPDATE SET
      "cuenta" = CASE
        WHEN "LimitePeticion"."ventanaAt" < now() - make_interval(secs => ${segundos}::double precision)
        THEN 1 ELSE "LimitePeticion"."cuenta" + 1 END,
      "ventanaAt" = CASE
        WHEN "LimitePeticion"."ventanaAt" < now() - make_interval(secs => ${segundos}::double precision)
        THEN now() ELSE "LimitePeticion"."ventanaAt" END
    RETURNING "cuenta"
  `

  const fila = filas[0]
  // Un UPSERT con RETURNING siempre devuelve una fila; si no llegara, es un
  // fallo de la base y lo correcto es no bloquear al ciudadano.
  return fila ? Number(fila.cuenta) <= maximo : true
}

/** Borra ventanas viejas. Lo llama /api/cron/mantenimiento. */
export async function limpiarLimites(masViejasQueHoras = 24) {
  const corte = new Date(Date.now() - masViejasQueHoras * 60 * 60 * 1000)
  const { count } = await prisma.limitePeticion.deleteMany({
    where: { ventanaAt: { lt: corte } },
  })
  return count
}
