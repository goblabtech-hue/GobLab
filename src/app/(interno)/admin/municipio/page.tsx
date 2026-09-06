import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requerirRol } from '@/lib/auth'
import { obtenerConfiguracion, TZ_MUNICIPIO } from '@/lib/config'
import { fechaHora } from '@/lib/utils'
import { Alerta } from '@/components/ui/alerta'
import { FormularioMunicipio } from './formulario'

export const metadata = { title: 'Datos del municipio' }
export const dynamic = 'force-dynamic'

export default async function PaginaMunicipio() {
  await requerirRol('admin')

  const [config, fila, reportes] = await Promise.all([
    obtenerConfiguracion(),
    prisma.configuracionMunicipio.findUnique({ where: { id: 1 } }),
    prisma.reporte.count(),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a administración
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Datos del municipio</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Esto es lo que ve el ciudadano en cada pantalla y en cada mensaje del
          bot. Los cambios se aplican de inmediato, sin reiniciar nada.
        </p>
        {fila && (
          <p className="mt-1 text-xs text-tenue">
            Última modificación: {fechaHora(fila.actualizadoAt)}
            {fila.actualizadoPor && ` · ${fila.actualizadoPor}`}
          </p>
        )}
      </div>

      <FormularioMunicipio inicial={config} hayReportes={reportes > 0} />

      <Alerta tipo="info" titulo="Lo que no se cambia desde aquí, y por qué">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            <strong>El huso horario</strong> (hoy <code>{TZ_MUNICIPIO}</code>) define
            qué cuenta como día hábil. Cambiarlo reinterpretaría la fecha límite de
            los {reportes} reportes que ya existen, así que se configura una sola
            vez al instalar, en el archivo <code>.env</code>.
          </li>
          <li>
            <strong>Las llaves y contraseñas</strong> de WhatsApp, Telegram y demás
            son secretos: no deben poder leerse desde una pantalla.
          </li>
        </ul>
      </Alerta>
    </div>
  )
}
