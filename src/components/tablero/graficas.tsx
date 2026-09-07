'use client'

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download } from 'lucide-react'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { descargarCsv } from './csv'

/**
 * Paleta del tablero. Los colores no son decorativos: verde = en tiempo,
 * ámbar = atención, rojo = incumplido. Se mantienen consistentes entre todas
 * las gráficas para que el ciudadano no tenga que releer la leyenda.
 */
export const COLORES = {
  marca: '#0d8465',
  marcaClaro: '#14a37b',
  verde: '#087443',
  ambar: '#9a5b06',
  rojo: '#b42318',
  azul: '#1d4ed8',
  tenue: '#7c8c87',
}

const SERIE = [COLORES.marca, COLORES.azul, COLORES.ambar, COLORES.rojo, COLORES.marcaClaro, COLORES.tenue]

const ejeComun = {
  tick: { fontSize: 12, fill: '#4a5f59' },
  tickLine: false,
  axisLine: { stroke: '#dfe6e2' },
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09" -> "sep 26" */
export function etiquetaMes(clave: string): string {
  const [a, m] = clave.split('-')
  if (!a || !m) return clave
  return `${MESES_CORTOS[Number(m) - 1] ?? m} ${a.slice(2)}`
}

function CajaTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-borde bg-papel px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function Grafica({
  titulo, explicacion, datos, nombreArchivo, alto = 260, children,
}: {
  titulo: string
  explicacion?: string
  datos: Record<string, unknown>[]
  nombreArchivo: string
  alto?: number
  children: React.ReactElement
}) {
  return (
    <Tarjeta>
      <TarjetaCuerpo>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{titulo}</h3>
            {explicacion && <p className="mt-0.5 text-sm text-tinta-suave">{explicacion}</p>}
          </div>
          <button
            type="button"
            onClick={() => descargarCsv(nombreArchivo, datos)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-borde px-2.5 py-1.5 text-xs font-medium text-tinta-suave hover:bg-lienzo hover:text-tinta"
          >
            <Download className="size-3.5" aria-hidden />
            CSV
          </button>
        </div>

        <div style={{ height: alto }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}

// ---------------------------------------------------------------- gráficas

export function BarrasHorizontales({
  datos, claveNombre, claveValor, etiqueta,
}: {
  datos: Record<string, unknown>[]
  claveNombre: string
  claveValor: string
  etiqueta: string
}) {
  return (
    <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
      <CartesianGrid horizontal={false} stroke="#dfe6e2" />
      <XAxis type="number" {...ejeComun} />
      <YAxis type="category" dataKey={claveNombre} width={150} {...ejeComun} />
      <Tooltip content={<CajaTooltip />} cursor={{ fill: '#f4f7f5' }} />
      <Bar dataKey={claveValor} name={etiqueta} fill={COLORES.marca} radius={[0, 4, 4, 0]} />
    </BarChart>
  )
}

export function LineasMensuales({
  datos, series,
}: {
  datos: Record<string, unknown>[]
  series: { clave: string; nombre: string; color?: string }[]
}) {
  return (
    <LineChart data={datos} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
      <CartesianGrid stroke="#dfe6e2" vertical={false} />
      <XAxis dataKey="mesCorto" {...ejeComun} />
      <YAxis {...ejeComun} width={40} />
      <Tooltip content={<CajaTooltip />} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {series.map((s, i) => (
        <Line
          key={s.clave} type="monotone" dataKey={s.clave} name={s.nombre}
          stroke={s.color ?? SERIE[i % SERIE.length]} strokeWidth={2}
          dot={false} activeDot={{ r: 4 }}
        />
      ))}
    </LineChart>
  )
}

export function BarrasApiladas({
  datos, series,
}: {
  datos: Record<string, unknown>[]
  series: { clave: string; nombre: string; color: string }[]
}) {
  return (
    <BarChart data={datos} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
      <CartesianGrid stroke="#dfe6e2" vertical={false} />
      <XAxis dataKey="mesCorto" {...ejeComun} />
      <YAxis {...ejeComun} width={40} />
      <Tooltip content={<CajaTooltip />} cursor={{ fill: '#f4f7f5' }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {series.map((s) => (
        <Bar key={s.clave} dataKey={s.clave} name={s.nombre} stackId="a" fill={s.color} />
      ))}
    </BarChart>
  )
}

export function BarrasSimples({
  datos, claveNombre, claveValor, etiqueta, colores,
}: {
  datos: Record<string, unknown>[]
  claveNombre: string
  claveValor: string
  etiqueta: string
  colores?: string[]
}) {
  return (
    <BarChart data={datos} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
      <CartesianGrid stroke="#dfe6e2" vertical={false} />
      <XAxis dataKey={claveNombre} {...ejeComun} />
      <YAxis {...ejeComun} width={40} />
      <Tooltip content={<CajaTooltip />} cursor={{ fill: '#f4f7f5' }} />
      <Bar dataKey={claveValor} name={etiqueta} radius={[4, 4, 0, 0]}>
        {datos.map((_, i) => (
          <Cell key={i} fill={colores?.[i] ?? COLORES.marca} />
        ))}
      </Bar>
    </BarChart>
  )
}
