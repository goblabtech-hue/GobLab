import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { DICCIONARIO } from '@/lib/datos-abiertos'
import { numero } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Alerta } from '@/components/ui/alerta'

export const metadata = {
  title: 'Datos abiertos',
  description: 'Descarga la base completa de reportes ciudadanos en CSV o JSON, sin datos personales.',
}

export const revalidate = 300

export default async function DatosAbiertos() {
  const total = await prisma.reporte.count()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Datos abiertos</h1>
      <p className="mt-2 text-tinta-suave text-pretty">
        Toda la base de reportes, actualizada en tiempo real, para que cualquiera
        pueda revisarla, analizarla o construir algo con ella. Son {numero(total)} reportes.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href="/api/datos-abiertos/reportes.csv"
          className="flex items-center gap-3 rounded-[--radius-tarjeta] border border-borde bg-papel p-4 hover:border-marca-200 hover:bg-marca-50/40"
        >
          <FileSpreadsheet className="size-8 shrink-0 text-marca-700" aria-hidden />
          <div>
            <p className="font-semibold">Descargar CSV</p>
            <p className="text-sm text-tinta-suave">Se abre en Excel o Google Sheets</p>
          </div>
          <Download className="ml-auto size-4 shrink-0 text-tenue" aria-hidden />
        </a>

        <a
          href="/api/datos-abiertos/reportes.json"
          className="flex items-center gap-3 rounded-[--radius-tarjeta] border border-borde bg-papel p-4 hover:border-marca-200 hover:bg-marca-50/40"
        >
          <FileJson className="size-8 shrink-0 text-marca-700" aria-hidden />
          <div>
            <p className="font-semibold">Consumir JSON</p>
            <p className="text-sm text-tinta-suave">Para programar sobre los datos</p>
          </div>
          <Download className="ml-auto size-4 shrink-0 text-tenue" aria-hidden />
        </a>
      </div>

      <Alerta tipo="info" titulo="Qué no incluye, y por qué" className="mt-6">
        El dataset no trae teléfonos ni nombres. Tampoco la descripción que
        escribió el ciudadano ni la dirección exacta: son textos libres donde es
        normal que aparezcan nombres o señas de vecinos, así que publicarlos
        filtraría datos personales aunque las columnas de contacto no estén. Las
        coordenadas van redondeadas a unos 11 metros — suficiente para ubicar un
        bache, no para señalar una casa.
      </Alerta>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Diccionario de datos</h2>
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Campo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Qué contiene</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {DICCIONARIO.map((d) => (
                  <tr key={d.campo}>
                    <td className="px-4 py-2.5"><code className="text-xs">{d.campo}</code></td>
                    <td className="px-4 py-2.5 text-tinta-suave">{d.tipo}</td>
                    <td className="px-4 py-2.5">{d.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-xl font-semibold tracking-tight">Uso</h2>
        <p className="text-tinta-suave">
          Los datos son de uso libre, incluso comercial, citando la fuente. Los
          endpoints aceptan peticiones desde cualquier origen y se refrescan cada
          cinco minutos.
        </p>
        <TarjetaCuerpo className="mt-3 rounded-lg bg-tinta p-4 text-sm text-papel">
          <pre className="overflow-x-auto"><code>curl -s https://TU-DOMINIO/api/datos-abiertos/reportes.json | jq &apos;.total&apos;</code></pre>
        </TarjetaCuerpo>
      </section>
    </div>
  )
}
