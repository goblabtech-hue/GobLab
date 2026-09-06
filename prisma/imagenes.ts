import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Genera localmente las imágenes placeholder de la demo (SPEC §11: "usa
 * imágenes placeholder generadas localmente"). No descarga nada de internet.
 */

const DIR = path.join(process.cwd(), 'public', 'uploads', 'seed')

const PALETA: Record<string, [string, string]> = {
  antes: ['#7c2d12', '#b45309'],
  despues: ['#065f46', '#059669'],
}

function svg(titulo: string, subtitulo: string, variante: 'antes' | 'despues') {
  const [a, b] = PALETA[variante]
  const etiqueta = variante === 'antes' ? 'ANTES' : 'DESPUÉS'
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <rect x="0" y="0" width="800" height="600" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="16"/>
  <text x="400" y="250" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="88" font-weight="700" fill="#fff" opacity=".95">${etiqueta}</text>
  <text x="400" y="330" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="36" fill="#fff" opacity=".9">${esc(titulo)}</text>
  <text x="400" y="385" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="24" fill="#fff" opacity=".7">${esc(subtitulo)}</text>
  <text x="400" y="550" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="18" fill="#fff" opacity=".55">Imagen de demostración generada localmente</text>
</svg>`)
}

export async function prepararDirImagenes() {
  await fs.rm(DIR, { recursive: true, force: true })
  await fs.mkdir(DIR, { recursive: true })
}

/** Devuelve la URL pública de la imagen generada. */
export async function generarImagen(
  nombre: string,
  titulo: string,
  subtitulo: string,
  variante: 'antes' | 'despues',
): Promise<string> {
  const archivo = `${nombre}.jpg`
  await sharp(svg(titulo, subtitulo, variante))
    .jpeg({ quality: 72 })
    .toFile(path.join(DIR, archivo))
  return `/uploads/seed/${archivo}`
}
