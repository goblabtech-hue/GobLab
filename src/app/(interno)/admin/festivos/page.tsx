import { CalendarDays, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { FormularioFestivo } from './formulario'
import { borrarFestivo } from '../acciones'

export const metadata = { title: 'Días festivos' }

const fmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

export default async function PaginaFestivos() {
  const festivos = await prisma.diaFestivo.findMany({ orderBy: { fecha: 'asc' } })
  const hoy = new Date()
  const proximos = festivos.filter((f) => f.fecha >= new Date(hoy.getFullYear(), 0, 1))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Días festivos</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Estos días no cuentan para el plazo de atención. Sábados y domingos ya
          se descuentan solos: aquí van únicamente los festivos oficiales y los
          locales del municipio.
        </p>
      </div>

      <Alerta tipo="aviso" titulo="Ojo con el efecto en los reportes">
        Agregar o quitar un día festivo cambia la fecha límite de los reportes
        que se creen a partir de ese momento. Los que ya existen conservan la
        fecha con la que se registraron.
      </Alerta>

      <Tarjeta>
        <TarjetaCuerpo>
          <h2 className="mb-4 font-semibold">Agregar un día festivo</h2>
          <FormularioFestivo />
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        <ul className="divide-y divide-borde">
          {proximos.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <CalendarDays className="size-4 shrink-0 text-tenue" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{f.nombre}</p>
                <p className="text-xs text-tinta-suave first-letter:uppercase">{fmt.format(f.fecha)}</p>
              </div>
              <form action={borrarFestivo}>
                <input type="hidden" name="id" value={f.id} />
                <Boton variante="fantasma" tamano="icono" type="submit" title={`Quitar ${f.nombre}`}>
                  <Trash2 aria-hidden />
                  <span className="sr-only">Quitar {f.nombre}</span>
                </Boton>
              </form>
            </li>
          ))}
          {proximos.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-tinta-suave">
              No hay días festivos registrados.
            </li>
          )}
        </ul>
      </Tarjeta>
    </div>
  )
}
