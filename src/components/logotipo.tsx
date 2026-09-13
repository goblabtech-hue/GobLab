import Image from 'next/image'
import { TEMAS, type Tema } from '@/domain/temas'

/**
 * El logotipo de la plataforma en la cabecera.
 *
 * Dos versiones del mismo archivo: a color para cabeceras claras y en blanco
 * para las oscuras (guinda, negro). Cuál va la decide el tema, no la página.
 * El nombre del municipio sigue siendo el texto alternativo: es lo que lee
 * un lector de pantalla y lo que aparece si la imagen no carga.
 */
export function Logotipo({ tema, municipio, alto = 32 }: { tema: Tema; municipio: string; alto?: number }) {
  const version = TEMAS[tema].logotipo
  const src = version === 'blanco' ? '/marca/demosvoz-blanco.png' : '/marca/demosvoz.png'
  // El archivo mide 1151×260: se conserva la proporción.
  const ancho = Math.round(alto * (1151 / 260))
  return (
    <Image
      src={src}
      alt={`DemosVoz · ${municipio}`}
      width={ancho}
      height={alto}
      priority
      className="h-8 w-auto"
    />
  )
}
