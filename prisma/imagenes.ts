import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Imágenes de la demostración, generadas localmente (SPEC §11).
 *
 * Son ilustraciones de escena, no fotos: una calle, edificios al fondo y el
 * problema en primer plano, con su versión resuelta. Se dibujan como SVG y se
 * rasterizan con sharp. Nada se descarga de internet.
 *
 * Una por categoría y variante (dos variantes: mañana y tarde), y el seed las
 * reutiliza: así los reportes de baches se parecen entre sí como se parecen
 * las fotos reales de baches, y generar 660 imágenes distintas no aporta nada.
 */

const DIR = path.join(process.cwd(), 'public', 'uploads', 'seed')
const W = 1200, H = 900

type Momento = 'manana' | 'tarde' | 'noche'
type Lado = 'antes' | 'despues'

const CIELO: Record<Momento, [string, string]> = {
  manana: ['#bfe3ff', '#e9f5ff'],
  tarde:  ['#f7c99b', '#fde9d3'],
  noche:  ['#1b2a4a', '#2f3f63'],
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Fondo común: cielo, edificios, banqueta y calle. */
function escena(momento: Momento, contenido: string, pie: string): Buffer {
  const [c1, c2] = CIELO[momento]
  const noche = momento === 'noche'
  const edificio = (x: number, w: number, h: number, tono: string) => {
    const ventanas: string[] = []
    for (let fy = H - 330 - h + 30; fy < H - 360; fy += 46) {
      for (let fx = x + 18; fx < x + w - 30; fx += 38) {
        const encendida = noche && ((fx * 7 + fy * 3) % 5 !== 0)
        ventanas.push(`<rect x="${fx}" y="${fy}" width="20" height="26" rx="2" fill="${encendida ? '#ffe08a' : 'rgba(255,255,255,.35)'}"/>`)
      }
    }
    return `<rect x="${x}" y="${H - 330 - h}" width="${w}" height="${h}" fill="${tono}"/>${ventanas.join('')}`
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="vineta" cx=".5" cy=".5" r=".75">
      <stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </radialGradient>
    <radialGradient id="luz" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffe9a3" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#cielo)"/>
  ${noche ? '<circle cx="980" cy="140" r="38" fill="#f6f1d6"/>' : '<circle cx="1000" cy="150" r="52" fill="#fff4c2" opacity=".85"/>'}
  ${edificio(0, 240, 260, noche ? '#3d4a63' : '#c9b8a8')}
  ${edificio(260, 190, 330, noche ? '#4a5570' : '#d9c7b1')}
  ${edificio(470, 300, 220, noche ? '#374259' : '#bfae9b')}
  ${edificio(790, 220, 300, noche ? '#46516b' : '#d5c3ad')}
  ${edificio(1030, 170, 250, noche ? '#3a4560' : '#c4b19d')}
  <!-- banqueta -->
  <rect x="0" y="${H - 330}" width="${W}" height="90" fill="${noche ? '#8d8f95' : '#d8d5cf'}"/>
  <rect x="0" y="${H - 330}" width="${W}" height="8" fill="${noche ? '#6f7178' : '#bdb9b2'}"/>
  <!-- calle -->
  <rect x="0" y="${H - 240}" width="${W}" height="240" fill="${noche ? '#3b3d44' : '#5a5d64'}"/>
  <rect x="0" y="${H - 240}" width="${W}" height="10" fill="${noche ? '#55575f' : '#7c7f86'}"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 220 + 40}" y="${H - 130}" width="120" height="10" rx="5" fill="#e8d98a" opacity=".85"/>`).join('')}
  ${contenido}
  <rect width="${W}" height="${H}" fill="url(#vineta)"/>
  <!-- pie, como el sello de una cámara -->
  <rect x="24" y="${H - 64}" width="${pie.length * 11 + 40}" height="40" rx="8" fill="rgba(0,0,0,.45)"/>
  <text x="44" y="${H - 37}" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="#fff" opacity=".95">${esc(pie)}</text>
</svg>`)
}

// ── Elementos por categoría ──────────────────────────────────────────────
// Cada uno devuelve el SVG del problema (antes) y de la solución (después).

const G = H - 240 // línea donde empieza la calle
const B = H - 330 // línea donde empieza la banqueta

const ESCENAS: Record<string, Record<Lado, string>> = {
  bache: {
    antes: `
      <path d="M470 ${G + 90} q40 -30 120 -20 q70 10 90 55 q-30 45 -110 45 q-90 -5 -100 -80z" fill="#1d1e22"/>
      <path d="M480 ${G + 95} q30 -20 100 -12 q55 8 70 40 q-25 30 -90 30 q-70 -5 -80 -58z" fill="#0b0b0d"/>
      ${['M420,'+(G+120)+' l-40,-30', 'M690,'+(G+150)+' l50,-25', 'M600,'+(G+75)+' l30,-40', 'M470,'+(G+190)+' l-25,40']
        .map((d) => `<path d="${d}" stroke="#2a2b30" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
      <ellipse cx="560" cy="${G + 135}" rx="70" ry="18" fill="#3a3c44" opacity=".5"/>`,
    despues: `
      <rect x="455" y="${G + 55}" width="250" height="130" rx="10" fill="#3b3e46"/>
      <rect x="455" y="${G + 55}" width="250" height="130" rx="10" fill="none" stroke="#2c2e35" stroke-width="3"/>`,
  },

  luminaria: {
    antes: `
      <rect x="820" y="${B - 380}" width="14" height="380" fill="#4b4f57"/>
      <path d="M827 ${B - 380} q60 -40 120 0" stroke="#4b4f57" stroke-width="12" fill="none"/>
      <rect x="922" y="${B - 395}" width="60" height="26" rx="8" fill="#6a6e78"/>`,
    despues: `
      <circle cx="952" cy="${B - 382}" r="190" fill="url(#luz)"/>
      <rect x="820" y="${B - 380}" width="14" height="380" fill="#4b4f57"/>
      <path d="M827 ${B - 380} q60 -40 120 0" stroke="#4b4f57" stroke-width="12" fill="none"/>
      <rect x="922" y="${B - 395}" width="60" height="26" rx="8" fill="#ffe08a"/>
      <ellipse cx="952" cy="${B - 30}" rx="170" ry="30" fill="#ffe9a3" opacity=".35"/>`,
  },

  'fuga-agua': {
    antes: `
      <ellipse cx="560" cy="${G + 110}" rx="220" ry="55" fill="#5aa9d6" opacity=".85"/>
      <ellipse cx="560" cy="${G + 110}" rx="140" ry="32" fill="#8ccbea" opacity=".8"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${520 + i * 12} ${G + 60} q${-30 + i * 10} -70 ${-10 + i * 6} -110" stroke="#9fd8f5" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>`).join('')}
      <rect x="530" y="${G + 40}" width="60" height="24" rx="4" fill="#3a3c44"/>`,
    despues: `
      <rect x="500" y="${G + 40}" width="120" height="70" rx="6" fill="#3b3e46"/>
      <rect x="530" y="${G + 40}" width="60" height="24" rx="4" fill="#2c2e35"/>`,
  },

  basura: {
    antes: `
      <ellipse cx="560" cy="${B + 60}" rx="150" ry="24" fill="rgba(0,0,0,.18)"/>
      <ellipse cx="470" cy="${B + 30}" rx="70" ry="55" fill="#2b2d33"/>
      <ellipse cx="560" cy="${B + 20}" rx="80" ry="62" fill="#1f5c3a"/>
      <ellipse cx="650" cy="${B + 35}" rx="65" ry="50" fill="#2b2d33"/>
      <rect x="600" y="${B - 50}" width="70" height="50" rx="4" fill="#c9a26b" transform="rotate(-12 635 ${B - 25})"/>
      <path d="M430 ${B - 10} l-30 -25 l20 -5 z" fill="#e6e0d0"/>
      <ellipse cx="520" cy="${B - 30}" rx="40" ry="30" fill="#3b6b46"/>`,
    despues: `
      <rect x="640" y="${B - 90}" width="70" height="110" rx="8" fill="#2f7a4d"/>
      <rect x="632" y="${B - 100}" width="86" height="16" rx="6" fill="#256339"/>
      <rect x="668" y="${B - 60}" width="14" height="40" rx="3" fill="#1d4d2d"/>`,
  },

  'arbol-riesgo': {
    antes: `
      <g transform="rotate(-24 300 ${B})">
        <rect x="288" y="${B - 300}" width="26" height="300" fill="#6b4a2b"/>
        <circle cx="300" cy="${B - 330}" r="110" fill="#5f8f4a"/>
        <circle cx="240" cy="${B - 290}" r="70" fill="#6a9c52"/>
        <circle cx="365" cy="${B - 280}" r="75" fill="#557f41"/>
      </g>
      <path d="M380 ${B - 120} l90 60 l-20 10 z" fill="#6b4a2b"/>
      <path d="M300 ${B - 60} l-8 -30" stroke="#3b2a18" stroke-width="6"/>
      <path d="M296 ${B - 90} l14 -22" stroke="#3b2a18" stroke-width="5"/>`,
    despues: `
      <rect x="288" y="${B - 300}" width="26" height="300" fill="#6b4a2b"/>
      <circle cx="300" cy="${B - 340}" r="105" fill="#5f8f4a"/>
      <circle cx="250" cy="${B - 300}" r="65" fill="#6a9c52"/>
      <circle cx="355" cy="${B - 295}" r="70" fill="#557f41"/>
      <rect x="270" y="${B - 8}" width="62" height="10" rx="3" fill="#7a6a58"/>`,
  },

  banqueta: {
    antes: `
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 200}" y="${B}" width="196" height="90" fill="none" stroke="#bdb9b2" stroke-width="3"/>`).join('')}
      <rect x="400" y="${B - 14}" width="196" height="90" fill="#cfcbc4" transform="rotate(-4 498 ${B + 30})"/>
      <path d="M430 ${B + 30} l40 25 l30 -10 l35 30" stroke="#6f6a63" stroke-width="5" fill="none"/>
      <path d="M640 ${B + 10} l25 35 l-15 30" stroke="#6f6a63" stroke-width="4" fill="none"/>
      <path d="M470 ${B + 70} q20 -8 45 6 q10 8 30 2" stroke="#4a4640" stroke-width="7" fill="none"/>`,
    despues: `
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 200}" y="${B}" width="196" height="90" fill="${i === 2 || i === 3 ? '#e2dfd8' : 'none'}" stroke="#bdb9b2" stroke-width="3"/>`).join('')}`,
  },

  semaforo: {
    antes: `
      <rect x="880" y="${B - 420}" width="14" height="420" fill="#4b4f57"/>
      <rect x="845" y="${B - 470}" width="84" height="210" rx="14" fill="#2b2d33"/>
      <circle cx="887" cy="${B - 425}" r="24" fill="#4a1c1c"/>
      <circle cx="887" cy="${B - 365}" r="24" fill="#4a3d15"/>
      <circle cx="887" cy="${B - 305}" r="24" fill="#183a22"/>`,
    despues: `
      <rect x="880" y="${B - 420}" width="14" height="420" fill="#4b4f57"/>
      <rect x="845" y="${B - 470}" width="84" height="210" rx="14" fill="#2b2d33"/>
      <circle cx="887" cy="${B - 425}" r="24" fill="#4a1c1c"/>
      <circle cx="887" cy="${B - 365}" r="24" fill="#4a3d15"/>
      <circle cx="887" cy="${B - 305}" r="40" fill="#39d353" opacity=".35"/>
      <circle cx="887" cy="${B - 305}" r="24" fill="#3ddc5f"/>`,
  },

  parque: {
    antes: `
      <rect x="0" y="${B - 40}" width="${W}" height="40" fill="#7c9a5a"/>
      ${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 30 + 10} ${B} l6 -36 l6 36" fill="#5f7d40"/>`).join('')}
      <path d="M380 ${B - 20} l70 -230 l70 230" stroke="#8a6a3c" stroke-width="14" fill="none"/>
      <path d="M700 ${B - 20} l70 -230 l70 230" stroke="#8a6a3c" stroke-width="14" fill="none"/>
      <rect x="450" y="${B - 262}" width="320" height="14" rx="4" fill="#8a6a3c"/>
      <path d="M520 ${B - 250} v130" stroke="#333" stroke-width="4"/>
      <path d="M660 ${B - 250} v90" stroke="#333" stroke-width="4"/>
      <rect x="495" y="${B - 120}" width="60" height="14" rx="3" fill="#c0392b" transform="rotate(25 525 ${B - 113})"/>`,
    despues: `
      <rect x="0" y="${B - 40}" width="${W}" height="40" fill="#7c9a5a"/>
      <path d="M380 ${B - 20} l70 -230 l70 230" stroke="#8a6a3c" stroke-width="14" fill="none"/>
      <path d="M700 ${B - 20} l70 -230 l70 230" stroke="#8a6a3c" stroke-width="14" fill="none"/>
      <rect x="450" y="${B - 262}" width="320" height="14" rx="4" fill="#8a6a3c"/>
      <path d="M520 ${B - 250} v130 M660 ${B - 250} v130" stroke="#333" stroke-width="4"/>
      <rect x="500" y="${B - 120}" width="60" height="14" rx="3" fill="#c0392b"/>
      <rect x="640" y="${B - 120}" width="60" height="14" rx="3" fill="#2980b9"/>`,
  },

  drenaje: {
    antes: `
      <ellipse cx="560" cy="${G + 100}" rx="240" ry="60" fill="#3d3a2a" opacity=".9"/>
      <ellipse cx="560" cy="${G + 100}" rx="170" ry="38" fill="#4a4530"/>
      ${[0, 1, 2].map((i) => `<path d="M${420 + i * 90} ${G + 96} q20 -10 40 0 q20 10 40 0" stroke="#6b6448" stroke-width="4" fill="none"/>`).join('')}
      <rect x="520" y="${G + 80}" width="80" height="40" rx="4" fill="#2b2d33"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${528 + i * 18}" y="${G + 86}" width="8" height="28" fill="#111"/>`).join('')}`,
    despues: `
      <rect x="520" y="${G + 80}" width="80" height="40" rx="4" fill="#2b2d33"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${528 + i * 18}" y="${G + 86}" width="8" height="28" fill="#111"/>`).join('')}`,
  },

  'coladera-sin-tapa': {
    antes: `
      <ellipse cx="560" cy="${G + 110}" rx="70" ry="28" fill="#0b0b0d"/>
      <ellipse cx="560" cy="${G + 110}" rx="70" ry="28" fill="none" stroke="#7c7f86" stroke-width="6"/>
      <rect x="470" y="${G + 20}" width="14" height="70" fill="#e67e22"/>
      <path d="M440 ${G + 20} h74 l-10 -30 h-54 z" fill="#e67e22"/>`,
    despues: `
      <ellipse cx="560" cy="${G + 110}" rx="70" ry="28" fill="#4a4d55"/>
      <ellipse cx="560" cy="${G + 110}" rx="70" ry="28" fill="none" stroke="#2c2e35" stroke-width="5"/>
      <ellipse cx="560" cy="${G + 110}" rx="45" ry="17" fill="none" stroke="#2c2e35" stroke-width="3"/>`,
  },

  'animal-calle': {
    antes: `
      <ellipse cx="620" cy="${B + 78}" rx="90" ry="14" fill="rgba(0,0,0,.18)"/>
      <ellipse cx="620" cy="${B + 40}" rx="70" ry="32" fill="#b58a5a"/>
      <circle cx="690" cy="${B + 20}" r="26" fill="#b58a5a"/>
      <path d="M705 ${B - 2} l16 -20 l6 26 z M680 ${B - 4} l-14 -20 l-2 26 z" fill="#8f6a3f"/>
      <circle cx="700" cy="${B + 18}" r="3" fill="#222"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${570 + i * 34}" y="${B + 60}" width="12" height="22" rx="4" fill="#8f6a3f"/>`).join('')}
      <path d="M552 ${B + 36} q-30 -20 -20 -45" stroke="#8f6a3f" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    despues: `
      <rect x="640" y="${B - 120}" width="90" height="120" rx="8" fill="#2f7a4d"/>
      <rect x="648" y="${B - 110}" width="74" height="60" rx="4" fill="#e8f5e9"/>
      <path d="M672 ${B - 70} l0 -30 M660 ${B - 85} l12 -15 l12 15" stroke="#2f7a4d" stroke-width="4" fill="none"/>`,
  },
}

/** Categorías que no tienen escena propia usan una genérica. */
const GENERICA: Record<Lado, string> = {
  antes: `<path d="M560 ${G + 40} l-40 70 h80 z" fill="#e67e22"/><rect x="552" y="${G + 62}" width="16" height="30" fill="#fff"/><circle cx="560" cy="${G + 100}" r="5" fill="#fff"/>`,
  despues: `<circle cx="560" cy="${G + 80}" r="40" fill="#2f7a4d"/><path d="M540 ${G + 80} l14 14 l28 -30" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
}

export async function prepararDirImagenes() {
  await fs.rm(DIR, { recursive: true, force: true })
  await fs.mkdir(DIR, { recursive: true })
}

const cache = new Map<string, string>()

/**
 * Imagen para una categoría y un lado. Se genera una vez por combinación y se
 * reutiliza. `variante` alterna el momento del día para que no todas las
 * fotos de baches sean idénticas.
 */
export async function imagenDeCategoria(
  slug: string, nombre: string, lado: Lado, variante: 0 | 1 = 0,
): Promise<string> {
  const archivo = `${slug}-${lado}-${variante}.jpg`
  const url = `/uploads/seed/${archivo}`
  if (cache.has(archivo)) return url

  const escenaCat = ESCENAS[slug] ?? GENERICA
  // Luminaria: el «antes» se entiende al atardecer, el «después» de noche.
  const momento: Momento = slug === 'luminaria'
    ? (lado === 'antes' ? 'tarde' : 'noche')
    : (variante === 0 ? 'manana' : 'tarde')
  const pie = lado === 'antes' ? `Reporte ciudadano · ${nombre}` : `Evidencia de cuadrilla · ${nombre}`

  await sharp(escena(momento, escenaCat[lado], pie))
    .jpeg({ quality: 82 })
    .toFile(path.join(DIR, archivo))
  cache.set(archivo, url)
  return url
}

/** Compatibilidad con el seed anterior. */
export async function generarImagen(
  nombre: string, titulo: string, _subtitulo: string, variante: Lado,
): Promise<string> {
  const slug = nombre.replace(/^.*?-(antes|despues)$/, '').toLowerCase()
  return imagenDeCategoria(slug || 'generico', titulo, variante)
}
