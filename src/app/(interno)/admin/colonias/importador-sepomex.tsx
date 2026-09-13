'use client'

import { useState, useTransition } from 'react'
import { Landmark, Upload, Check } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { subirCatalogoSepomex, municipiosSepomex, importarSepomex } from '../acciones'
import type { ResumenSepomex } from '@/application/sepomex'

/**
 * Cargar las colonias de un municipio desde el catálogo nacional de SEPOMEX.
 *
 * Tres pasos en una sola tarjeta: subir el archivo, elegir el estado, elegir
 * el municipio. El archivo se sube una vez; los pasos siguientes usan un
 * token. Es la forma de dar de alta cualquier municipio del país sin teclear
 * una sola colonia.
 */
export function ImportadorSepomex() {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [catalogo, setCatalogo] = useState<{ token: string; estados: string[]; total: number } | null>(null)
  const [estado, setEstado] = useState('')
  const [municipios, setMunicipios] = useState<{ nombre: string; asentamientos: number }[] | null>(null)
  const [municipio, setMunicipio] = useState('')
  const [resumen, setResumen] = useState<ResumenSepomex | null>(null)

  const subir = () => {
    if (!archivo) return
    setError(null)
    empezar(async () => {
      const fd = new FormData()
      fd.set('archivo', archivo)
      const r = await subirCatalogoSepomex(fd)
      if (r.token && r.estados && r.total !== undefined) {
        setCatalogo({ token: r.token, estados: r.estados, total: r.total })
      } else setError(r.error ?? 'No se pudo leer el archivo.')
    })
  }

  const elegirEstado = (e: string) => {
    setEstado(e); setMunicipios(null); setMunicipio(''); setError(null)
    if (!e || !catalogo) return
    empezar(async () => {
      const r = await municipiosSepomex(catalogo.token, e)
      if (r.municipios) setMunicipios(r.municipios)
      else setError(r.error ?? 'No se pudo leer el catálogo.')
    })
  }

  const importar = () => {
    if (!catalogo || !municipio) return
    setError(null)
    empezar(async () => {
      const r = await importarSepomex(catalogo.token, municipio, estado)
      if (r.resumen) setResumen(r.resumen)
      else setError(r.error ?? 'No se pudo importar.')
    })
  }

  const municipioElegido = municipios?.find((m) => m.nombre === municipio)

  return (
    <Tarjeta>
      <TarjetaCuerpo className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Landmark className="size-5 text-marca-600" aria-hidden />
            Cargar desde el catálogo nacional (Correos de México)
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Trae todas las colonias, pueblos y fraccionamientos de cualquier municipio del país,
            con su código postal. Baja el catálogo en{' '}
            <a
              href="https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx"
              target="_blank" rel="noopener noreferrer" className="text-marca-700 underline"
            >
              correosdemexico.gob.mx
            </a>
            {' '}— opción <strong>todo el país</strong>, formato <strong>TXT</strong> — y súbelo aquí.
          </p>
        </div>

        {resumen ? (
          <Alerta tipo="exito" titulo={`${resumen.municipio}, ${resumen.estado}: listo`}>
            {resumen.creados} asentamientos nuevos y {resumen.actualizados} que ya existían.
            {' '}{resumen.porTipo.map((t) => `${t.total} ${t.tipo.toLowerCase()}`).join(', ')}.
            {' '}Los ves abajo en la lista.
          </Alerta>
        ) : (
          <ol className="space-y-4">
            {/* Paso 1: archivo */}
            <li className="flex gap-3">
              <Paso n={1} listo={Boolean(catalogo)} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">El archivo del catálogo</p>
                {catalogo ? (
                  <p className="text-sm text-tinta-suave">
                    {catalogo.total.toLocaleString('es-MX')} asentamientos en {catalogo.estados.length} estados.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file" accept=".txt,text/plain"
                      onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                      className="text-sm file:mr-3 file:rounded-lg file:border file:border-borde file:bg-papel file:px-3 file:py-1.5 file:text-sm"
                    />
                    <Boton type="button" onClick={subir} disabled={!archivo || pendiente}>
                      <Upload aria-hidden />
                      {pendiente ? 'Leyendo…' : 'Leer catálogo'}
                    </Boton>
                  </div>
                )}
              </div>
            </li>

            {/* Paso 2: estado */}
            <li className="flex gap-3">
              <Paso n={2} listo={Boolean(municipios)} inactivo={!catalogo} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">El estado</p>
                <select
                  value={estado} onChange={(e) => elegirEstado(e.target.value)}
                  disabled={!catalogo || pendiente}
                  className="h-10 w-full max-w-sm rounded-lg border border-borde bg-papel px-3 text-sm disabled:opacity-50"
                >
                  <option value="">Elige un estado…</option>
                  {catalogo?.estados.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </li>

            {/* Paso 3: municipio */}
            <li className="flex gap-3">
              <Paso n={3} inactivo={!municipios} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">El municipio</p>
                <select
                  value={municipio} onChange={(e) => setMunicipio(e.target.value)}
                  disabled={!municipios || pendiente}
                  className="h-10 w-full max-w-sm rounded-lg border border-borde bg-papel px-3 text-sm disabled:opacity-50"
                >
                  <option value="">{municipios ? `Elige uno de ${municipios.length}…` : 'Primero el estado'}</option>
                  {municipios?.map((m) => (
                    <option key={m.nombre} value={m.nombre}>{m.nombre} ({m.asentamientos})</option>
                  ))}
                </select>
                {municipioElegido && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Boton type="button" onClick={importar} disabled={pendiente}>
                      {pendiente ? 'Cargando…' : `Cargar ${municipioElegido.asentamientos} asentamientos`}
                    </Boton>
                    <p className="text-xs text-tenue">
                      Si alguno ya existe con el mismo nombre y código postal, se actualiza; no se duplica.
                    </p>
                  </div>
                )}
              </div>
            </li>
          </ol>
        )}

        {error && <Alerta tipo="error">{error}</Alerta>}
      </TarjetaCuerpo>
    </Tarjeta>
  )
}

function Paso({ n, listo, inactivo }: { n: number; listo?: boolean; inactivo?: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        listo ? 'bg-marca-600 text-white' : inactivo ? 'bg-lienzo text-tenue' : 'bg-marca-50 text-marca-700',
      ].join(' ')}
    >
      {listo ? <Check className="size-3.5" /> : n}
    </span>
  )
}
