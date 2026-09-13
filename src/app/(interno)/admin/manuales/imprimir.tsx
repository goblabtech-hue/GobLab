'use client'

import { Printer } from 'lucide-react'
import { Boton } from '@/components/ui/boton'

export function Imprimir() {
  return (
    <Boton variante="secundario" type="button" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />Imprimir
    </Boton>
  )
}
