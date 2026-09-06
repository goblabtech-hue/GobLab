'use client'

import { ORIGEN, ESTATUS } from '@/lib/presentacion'
import type { Indicadores } from '@/lib/indicadores'
import {
  BarrasApiladas, BarrasHorizontales, BarrasSimples, COLORES, Grafica,
  LineasMensuales, etiquetaMes,
} from './graficas'

/**
 * Las siete gráficas del SPEC §4.4e. Cada una con su descarga en CSV y con
 * títulos en lenguaje ciudadano: "por tipo de problema", no "por secretaría".
 */
export function SeccionGraficas({ datos }: { datos: Indicadores }) {
  const conMes = <T extends { mes: string }>(filas: T[]) =>
    filas.map((f) => ({ ...f, mesCorto: etiquetaMes(f.mes) }))

  const evolucion = conMes(datos.evolucionMensual)
  const puntualidad = conMes(datos.puntualidadMensual)
  const reasignados = conMes(datos.reasignadosMensual)

  const estatus = datos.porEstatus.map((e) => ({
    estado: ESTATUS[e.estatus].ciudadano,
    total: e.total,
  }))
  const origen = datos.porOrigen.map((o) => ({ canal: ORIGEN[o.origen], total: o.total }))
  const calificaciones = datos.calificaciones.map((c) => ({
    estrellas: `${c.estrellas} ★`,
    total: c.total,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Grafica
        titulo="Qué reporta más la gente"
        explicacion="Por tipo de problema, en los últimos 12 meses."
        datos={datos.porCategoria} nombreArchivo="reportes-por-tipo" alto={340}
      >
        <BarrasHorizontales datos={datos.porCategoria} claveNombre="nombre" claveValor="total" etiqueta="Reportes" />
      </Grafica>

      <Grafica
        titulo="Cómo ha ido mes a mes"
        explicacion="Reportes que recibimos y reportes que resolvimos."
        datos={evolucion} nombreArchivo="evolucion-mensual" alto={340}
      >
        <LineasMensuales
          datos={evolucion}
          series={[
            { clave: 'recibidos', nombre: 'Recibidos', color: COLORES.azul },
            { clave: 'resueltos', nombre: 'Resueltos', color: COLORES.marca },
          ]}
        />
      </Grafica>

      <Grafica
        titulo="En qué van los reportes"
        explicacion="Todos los reportes registrados, por su estado actual."
        datos={estatus} nombreArchivo="reportes-por-estado"
      >
        <BarrasSimples datos={estatus} claveNombre="estado" claveValor="total" etiqueta="Reportes" />
      </Grafica>

      <Grafica
        titulo="¿Llegamos a tiempo?"
        explicacion="Reportes resueltos dentro del plazo prometido y fuera de él, cada mes."
        datos={puntualidad} nombreArchivo="puntualidad-mensual"
      >
        <BarrasApiladas
          datos={puntualidad}
          series={[
            { clave: 'aTiempo', nombre: 'A tiempo', color: COLORES.verde },
            { clave: 'tarde', nombre: 'Fuera de plazo', color: COLORES.rojo },
          ]}
        />
      </Grafica>

      <Grafica
        titulo="Por dónde nos reporta la gente"
        explicacion="El canal por el que llegó cada reporte."
        datos={origen} nombreArchivo="reportes-por-canal"
      >
        <BarrasSimples
          datos={origen} claveNombre="canal" claveValor="total" etiqueta="Reportes"
          colores={[COLORES.marca, COLORES.azul, COLORES.ambar, COLORES.tenue]}
        />
      </Grafica>

      <Grafica
        titulo="Reportes que cambiaron de área"
        explicacion="Cuando un reporte llega al área equivocada hay que pasarlo a otra. Publicamos este número porque mide qué tan bien clasificamos, no qué tan bien trabajamos."
        datos={reasignados} nombreArchivo="reportes-reasignados"
      >
        <LineasMensuales
          datos={reasignados}
          series={[{ clave: 'total', nombre: 'Reasignados', color: COLORES.ambar }]}
        />
      </Grafica>

      <Grafica
        titulo="Cómo nos califica la gente"
        explicacion="Estrellas que dieron los ciudadanos al cerrarse su reporte."
        datos={calificaciones} nombreArchivo="calificaciones"
      >
        <BarrasSimples
          datos={calificaciones} claveNombre="estrellas" claveValor="total" etiqueta="Reportes"
          colores={[COLORES.rojo, COLORES.rojo, COLORES.ambar, COLORES.marcaClaro, COLORES.verde]}
        />
      </Grafica>
    </div>
  )
}
