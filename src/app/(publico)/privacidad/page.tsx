import Link from 'next/link'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { avisoPublicado } from '@/application/privacidad'
import { markdownAHtml } from '@/domain/markdown'
import { fecha } from '@/domain/formato'
import { Alerta } from '@/components/ui/alerta'

export const metadata = {
  title: 'Aviso de privacidad',
  description: 'Qué datos recabamos al levantar un reporte, para qué los usamos y qué derechos tienes.',
}

export const dynamic = 'force-dynamic'

/**
 * Aviso de privacidad público (SPEC §7).
 *
 * El texto lo administra el municipio en `/admin/privacidad` y se versiona: es
 * un documento legal, y quien reportó hace seis meses aceptó la redacción de
 * entonces, no la de hoy.
 */
export default async function Privacidad() {
  const [municipio, aviso] = await Promise.all([obtenerConfiguracion(), avisoPublicado()])

  if (!aviso) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Aviso de privacidad</h1>
        <Alerta tipo="aviso" titulo="Todavía no se ha publicado" className="mt-5">
          El municipio de {municipio.nombre} aún no publica su aviso de privacidad
          en este sistema. Mientras tanto, esto es lo que el sistema hace con tus
          datos: tu teléfono se guarda cifrado y solo lo ve el personal
          autorizado; ni el tablero público ni los datos abiertos incluyen tu
          teléfono, tu nombre, tu descripción ni tu dirección exacta.
        </Alerta>
        <p className="mt-4 text-sm text-tinta-suave">
          Si necesitas el aviso formal, pídelo en la Unidad de Transparencia del
          municipio.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{aviso.titulo}</h1>
      <p className="mt-2 text-sm text-tenue">
        {municipio.nombre} · versión {aviso.version} · vigente desde {fecha(aviso.updatedAt)}
      </p>

      <article
        className="mt-6 text-pretty [&_a]:text-marca-700 [&_a]:underline [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:mt-1 [&_p]:mt-2.5 [&_p]:text-tinta-suave [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-tinta-suave [&_blockquote]:my-4 [&_blockquote]:rounded-lg [&_blockquote]:border [&_blockquote]:border-ambar-600/25 [&_blockquote]:bg-ambar-50 [&_blockquote]:p-4 [&_blockquote_p]:text-ambar-600 [&_blockquote_p]:mt-0"
        dangerouslySetInnerHTML={{ __html: markdownAHtml(aviso.contenido) }}
      />

      <p className="mt-10 border-t border-borde pt-4 text-sm text-tinta-suave">
        ¿Dudas sobre tus datos? Escríbenos desde{' '}
        <Link href="/reportar" className="text-marca-700 underline">el formulario de reporte</Link>{' '}
        o acude a la Unidad de Transparencia del municipio.
      </p>
    </div>
  )
}
