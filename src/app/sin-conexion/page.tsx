import { WifiOff } from 'lucide-react'

export const metadata = { title: 'Sin conexión' }

/** Lo que ve el ciudadano si abre la app sin internet. */
export default function SinConexion() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-12 text-tenue" aria-hidden />
      <h1 className="text-xl font-semibold">No hay conexión</h1>
      <p className="max-w-sm text-tinta-suave">
        Para reportar un problema hace falta internet. Cuando vuelva la señal, recarga esta página:
        tu reporte se levanta en menos de dos minutos.
      </p>
    </main>
  )
}
