import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Campo, Entrada } from '@/components/ui/campo'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Consultar mi folio' }

async function buscar(datos: FormData) {
  'use server'
  const folio = String(datos.get('folio') ?? '').trim().toUpperCase()
  if (!folio) redirect('/folio?vacio=1')

  const existe = await prisma.reporte.findUnique({ where: { folio }, select: { folio: true } })
  redirect(existe ? `/folio/${existe.folio}` : `/folio?noEncontrado=${encodeURIComponent(folio)}`)
}

export default async function PaginaBuscarFolio({ searchParams }: PageProps<'/folio'>) {
  const { noEncontrado, vacio } = await searchParams

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Consultar mi folio</h1>
      <p className="mt-1 mb-6 text-tinta-suave">
        Escribe el folio que te dimos cuando levantaste tu reporte.
      </p>

      {vacio && <Alerta tipo="aviso" className="mb-4">Escribe tu folio para poder buscarlo.</Alerta>}
      {typeof noEncontrado === 'string' && (
        <Alerta tipo="error" titulo="No encontramos ese folio" className="mb-4">
          Revisa que esté completo, incluidos los guiones. Buscamos <strong>{noEncontrado}</strong>.
        </Alerta>
      )}

      <Tarjeta>
        <TarjetaCuerpo>
          <form action={buscar} className="space-y-4">
            <Campo id="folio" etiqueta="Folio" requerido ayuda="Se ve así: MUN-2026-00341">
              <Entrada
                id="folio" name="folio" required autoFocus
                autoCapitalize="characters" spellCheck={false}
                placeholder="MUN-2026-00341" className="font-mono tracking-wide"
              />
            </Campo>
            <Boton type="submit" tamano="lg" className="w-full">
              <Search aria-hidden />
              Buscar mi reporte
            </Boton>
          </form>
        </TarjetaCuerpo>
      </Tarjeta>

      <p className="mt-6 text-sm text-tinta-suave">
        ¿Perdiste tu folio? Si nos diste tu teléfono, escríbenos por WhatsApp y te
        decimos cuáles reportes tienes abiertos.
      </p>
    </div>
  )
}
