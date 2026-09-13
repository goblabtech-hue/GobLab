import Image from 'next/image'
import { TEMAS, type Tema } from '@/domain/temas'

/**
 * El logotipo de la cabecera.
 *
 * Si el municipio subió el suyo en /admin/municipio, va ese; si no, el de la
 * plataforma. En los dos casos hay una versión a color para cabeceras claras
 * y una en blanco para las oscuras, y cuál se usa lo decide el tema, no la
 * página. El nombre del municipio sigue siendo el texto alternativo.
 */
export function Logotipo({
  tema, municipio, logoUrl, logoBlancoUrl, alto = 32,
}: {
  tema: Tema
  municipio: string
  logoUrl?: string | null
  logoBlancoUrl?: string | null
  alto?: number
}) {
  const blanco = TEMAS[tema].logotipo === 'blanco'
  const propio = logoUrl && logoBlancoUrl
  const src = propio
    ? (blanco ? logoBlancoUrl : logoUrl)
    : (blanco ? '/marca/demosvoz-blanco.png' : '/marca/demosvoz.png')

  return (
    <Image
      src={src}
      alt={propio ? municipio : `DemosVoz · ${municipio}`}
      // Las dimensiones son un tope: el logotipo del municipio puede tener
      // cualquier proporción y el alto lo fija la clase.
      width={alto * 5}
      height={alto}
      priority
      unoptimized={Boolean(propio)}
      className="w-auto"
      style={{ height: alto }}
    />
  )
}
