'use client'

import type { Indicadores } from '@/application/indicadores'
import { BarrasApiladas, BarrasHorizontales, COLORES, Grafica, LineasMensuales, etiquetaMes } from '@/components/tablero/graficas'

/** Las tres gráficas que le importan a un área: qué le llega, cómo va, y si cumple. */
export function GraficasArea({ datos }: { datos: Indicadores }) {
  const conMes = <T extends { mes: string }>(filas: T[]) => filas.map((f) => ({ ...f, mesCorto: etiquetaMes(f.mes) }))
  const evolucion = conMes(datos.evolucionMensual)
  const puntualidad = conMes(datos.puntualidadMensual)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Grafica titulo="Cómo ha ido mes a mes" explicacion="Reportes que llegaron al área y reportes que resolvió." datos={evolucion} nombreArchivo="area-evolucion" alto={280}>
        <LineasMensuales datos={evolucion} series={[
          { clave: 'recibidos', nombre: 'Recibidos', color: COLORES.azul },
          { clave: 'resueltos', nombre: 'Resueltos', color: COLORES.marca },
        ]} />
      </Grafica>
      <Grafica titulo="A tiempo o tarde" explicacion="De lo resuelto cada mes, cuánto cumplió el plazo." datos={puntualidad} nombreArchivo="area-puntualidad" alto={280}>
        <BarrasApiladas datos={puntualidad} series={[
          { clave: 'aTiempo', nombre: 'A tiempo', color: COLORES.verde },
          { clave: 'tarde', nombre: 'Tarde', color: COLORES.rojo },
        ]} />
      </Grafica>
      <Grafica titulo="Qué le llega más" explicacion="Por tipo de problema, últimos 12 meses." datos={datos.porCategoria} nombreArchivo="area-por-tipo" alto={280}>
        <BarrasHorizontales datos={datos.porCategoria} claveNombre="nombre" claveValor="total" etiqueta="Reportes" />
      </Grafica>
    </div>
  )
}
