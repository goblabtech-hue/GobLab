'use client'

import { useEffect } from 'react'
import { ligarFolio } from './app-nativa'

/** En la página de un folio: si es la app, este teléfono lo sigue desde ahora. */
export function SeguirFolioEnApp({ folio }: { folio: string }) {
  useEffect(() => { void ligarFolio(folio) }, [folio])
  return null
}
