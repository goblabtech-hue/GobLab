import { redirect } from 'next/navigation'

/**
 * La raíz del sitio.
 *
 * En la instancia de demostración —la que se enseña para vender— quien entra
 * es un alcalde o un director, y lo primero que debe ver es qué es la
 * plataforma. En la instalación real de un municipio quien entra es un vecino
 * con un bache, y lo primero que debe ver es cómo reportarlo. Un solo sitio,
 * dos públicos; el modo decide.
 */
export default function Raiz() {
  redirect(process.env.MODO_DEMO === 'true' ? '/plataforma' : '/inicio')
}
