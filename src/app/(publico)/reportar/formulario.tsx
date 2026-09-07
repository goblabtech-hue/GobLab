'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Camera, Crosshair, Loader2, MapPin, Users, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Campo, Entrada, AreaTexto, Selector, Etiqueta, Ayuda } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { IconoCategoria } from '@/components/icono-categoria'
import { MAX_FOTOS_CIUDADANO } from '@/infrastructure/almacenamiento/provider'
import type { Centro } from '@/components/mapa-selector'
import { cercanos, enviarReporte, type EstadoReporte } from './acciones'

// Leaflet necesita `window`: fuera del render del servidor.
const MapaSelector = dynamic(
  () => import('@/components/mapa-selector').then((m) => m.MapaSelector),
  { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-lienzo" /> },
)

type Categoria = { id: number; slug: string; nombre: string; icono: string; slaDiasHabiles: number }
type Colonia = { id: number; nombre: string }
type Cercano = Awaited<ReturnType<typeof cercanos>>[number]

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="lg" className="w-full sm:w-auto" disabled={pending}>
      {pending ? <><Loader2 className="animate-spin" aria-hidden />Enviando…</> : 'Enviar mi reporte'}
    </Boton>
  )
}

export function FormularioReporte({
  categorias, colonias, centro, categoriaInicial,
}: {
  categorias: Categoria[]
  colonias: Colonia[]
  centro: Centro
  categoriaInicial?: string
}) {
  const [estado, enviar] = useActionState<EstadoReporte, FormData>(enviarReporte, {})

  const [categoriaId, setCategoriaId] = useState<number | null>(
    categorias.find((c) => c.slug === categoriaInicial)?.id ?? null,
  )
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [ubicando, setUbicando] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [fotos, setFotos] = useState<File[]>([])
  const [parecidos, setParecidos] = useState<Cercano[]>([])
  const [, empezar] = useTransition()
  const inputFotos = useRef<HTMLInputElement>(null)

  const categoria = useMemo(
    () => categorias.find((c) => c.id === categoriaId) ?? null,
    [categorias, categoriaId],
  )

  // Reportes parecidos: se consultan en cuanto hay categoría y pin, para poder
  // ofrecer la adhesión ANTES de crear un duplicado (SPEC §4.2).
  useEffect(() => {
    if (categoriaId == null || lat == null || lng == null) return
    let vigente = true
    empezar(async () => {
      const r = await cercanos(categoriaId, lat, lng)
      if (vigente) setParecidos(r)
    })
    return () => { vigente = false }
  }, [categoriaId, lat, lng])

  // Se derivan en vez de limpiarse desde el efecto: si falta categoría o pin,
  // no hay nada que comparar y mostrar resultados viejos confundiría.
  const parecidosVisibles =
    categoriaId != null && lat != null && lng != null ? parecidos : []

  const vistasPrevias = useMemo(
    () => fotos.map((f) => ({ nombre: f.name, url: URL.createObjectURL(f) })),
    [fotos],
  )
  useEffect(() => () => vistasPrevias.forEach((v) => URL.revokeObjectURL(v.url)), [vistasPrevias])

  function ubicarme() {
    if (!navigator.geolocation) {
      setErrorUbicacion('Tu navegador no puede darnos la ubicación. Pon el pin en el mapa o elige tu colonia.')
      return
    }
    setUbicando(true)
    setErrorUbicacion(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setUbicando(false)
      },
      () => {
        setUbicando(false)
        setErrorUbicacion('No pudimos obtener tu ubicación. Pon el pin en el mapa o elige tu colonia.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function agregarFotos(lista: FileList | null) {
    if (!lista) return
    setFotos((previas) => [...previas, ...Array.from(lista)].slice(0, MAX_FOTOS_CIUDADANO))
  }

  function quitarFoto(i: number) {
    setFotos((previas) => previas.filter((_, j) => j !== i))
  }

  // El input file se re-sincroniza con el estado para que el envío mande
  // exactamente las fotos que se ven en pantalla.
  useEffect(() => {
    if (!inputFotos.current) return
    const dt = new DataTransfer()
    fotos.forEach((f) => dt.items.add(f))
    inputFotos.current.files = dt.files
  }, [fotos])

  return (
    <form action={enviar} className="space-y-8">
      {/* ---------------------------------------------------- categoría */}
      <fieldset>
        <legend className="text-base font-semibold">1. ¿Qué está pasando?</legend>
        <p className="mt-1 mb-3 text-sm text-tinta-suave">Elige lo que más se parezca.</p>

        <input type="hidden" name="categoriaId" value={categoriaId ?? ''} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {categorias.map((c) => {
            const activa = c.id === categoriaId
            return (
              <button
                key={c.id} type="button" onClick={() => setCategoriaId(c.id)}
                aria-pressed={activa}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  activa
                    ? 'border-marca-600 bg-marca-50 ring-1 ring-marca-600'
                    : 'border-borde bg-papel hover:bg-lienzo'
                }`}
              >
                <IconoCategoria nombre={c.icono} className={activa ? 'size-6 text-marca-700' : 'size-6 text-tinta-suave'} />
                <span className="mt-1.5 block text-sm leading-snug font-medium">{c.nombre}</span>
              </button>
            )
          })}
        </div>

        {categoria && (
          <p className="mt-3 rounded-lg bg-marca-50 p-3 text-sm text-marca-700">
            Los reportes de <strong>{categoria.nombre.toLowerCase()}</strong> se atienden
            en un máximo de <strong>{categoria.slaDiasHabiles} días hábiles</strong>.
          </p>
        )}
      </fieldset>

      {/* ---------------------------------------------------- descripción */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">2. Cuéntanos qué viste</legend>

        <Campo
          id="descripcion" etiqueta="Descripción" requerido
          ayuda="Entre más detalles, más rápido lo resolvemos. Por ejemplo: qué tan grande es, desde cuándo, si es peligroso."
          error={estado.campo === 'descripcion' ? estado.error : null}
        >
          <AreaTexto
            id="descripcion" name="descripcion" required minLength={10} maxLength={2000}
            placeholder="Hay un bache muy grande frente a la escuela, ya se ponchó una llanta."
          />
        </Campo>

        <div>
          <Etiqueta htmlFor="fotos">
            Fotos <span className="ml-1 font-normal text-tenue">(opcional, hasta {MAX_FOTOS_CIUDADANO})</span>
          </Etiqueta>
          <Ayuda className="mt-1">Una foto ayuda muchísimo a la cuadrilla a saber qué llevar.</Ayuda>

          <input
            ref={inputFotos} id="fotos" name="fotos" type="file"
            accept="image/*" multiple capture="environment"
            className="sr-only"
            onChange={(e) => agregarFotos(e.target.files)}
          />

          <div className="mt-2 flex flex-wrap gap-2.5">
            {vistasPrevias.map((v, i) => (
              <div key={v.url} className="relative">
                <Image
                  src={v.url} alt={`Foto ${i + 1}: ${v.nombre}`}
                  width={96} height={96} unoptimized
                  className="size-24 rounded-lg border border-borde object-cover"
                />
                <button
                  type="button" onClick={() => quitarFoto(i)}
                  className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-borde bg-papel shadow-sm"
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Quitar la foto {i + 1}</span>
                </button>
              </div>
            ))}

            {fotos.length < MAX_FOTOS_CIUDADANO && (
              <button
                type="button" onClick={() => inputFotos.current?.click()}
                className="grid size-24 place-items-center gap-1 rounded-lg border border-dashed border-borde text-tinta-suave hover:bg-lienzo"
              >
                <Camera className="size-6" aria-hidden />
                <span className="text-xs">Agregar</span>
              </button>
            )}
          </div>
          {estado.campo === 'fotos' && <p role="alert" className="mt-2 text-sm font-medium text-rojo-600">{estado.error}</p>}
        </div>
      </fieldset>

      {/* ---------------------------------------------------- ubicación */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">3. ¿Dónde está?</legend>

        <input type="hidden" name="lat" value={lat ?? ''} />
        <input type="hidden" name="lng" value={lng ?? ''} />

        <Boton type="button" variante="secundario" onClick={ubicarme} disabled={ubicando}>
          {ubicando ? <Loader2 className="animate-spin" aria-hidden /> : <Crosshair aria-hidden />}
          {ubicando ? 'Buscando…' : 'Usar mi ubicación'}
        </Boton>

        <p className="text-sm text-tinta-suave">
          O toca el mapa para poner el pin donde está el problema. Puedes arrastrarlo para ajustarlo.
        </p>

        <MapaSelector lat={lat} lng={lng} centro={centro} onCambio={(a, b) => { setLat(a); setLng(b); setErrorUbicacion(null) }} />

        {lat != null && (
          <p className="flex items-center gap-1.5 text-sm text-marca-700">
            <MapPin className="size-4" aria-hidden />
            Ubicación marcada
          </p>
        )}
        {errorUbicacion && <Alerta tipo="aviso">{errorUbicacion}</Alerta>}

        <Campo
          id="coloniaId" etiqueta="Colonia"
          ayuda="Si no puedes marcar el mapa, con la colonia nos basta para empezar."
        >
          <Selector id="coloniaId" name="coloniaId" defaultValue="">
            <option value="">Selecciona tu colonia…</option>
            {colonias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Selector>
        </Campo>

        <Campo id="direccionTexto" etiqueta="Calle y referencias">
          <Entrada id="direccionTexto" name="direccionTexto" maxLength={300}
            placeholder="Av. Juárez casi esquina con Morelos, frente a la tienda" />
        </Campo>

        {estado.campo === 'ubicacion' && <Alerta tipo="error">{estado.error}</Alerta>}
      </fieldset>

      {/* ---------------------------------------------------- duplicados */}
      {parecidosVisibles.length > 0 && (
        <Tarjeta className="border-ambar-600/30 bg-ambar-50">
          <TarjetaCuerpo>
            <div className="flex gap-3">
              <Users className="mt-0.5 size-5 shrink-0 text-ambar-600" aria-hidden />
              <div className="min-w-0 space-y-3">
                <div>
                  <p className="font-semibold text-ambar-600">
                    Ya hay {parecidosVisibles.length === 1 ? 'un reporte' : `${parecidosVisibles.length} reportes`} de
                    esto muy cerca
                  </p>
                  <p className="mt-1 text-sm text-tinta-suave">
                    Si es el mismo problema, únete al reporte que ya existe: sube de
                    prioridad y te avisamos cuando se resuelva. Si es otro, continúa abajo.
                  </p>
                </div>

                <ul className="space-y-2">
                  {parecidosVisibles.map((p) => (
                    <li key={p.id} className="rounded-lg border border-borde bg-papel p-3">
                      <p className="text-sm">{p.descripcion}</p>
                      <p className="mt-1 text-xs text-tinta-suave">
                        Folio {p.folio} · a {p.metros} m
                        {p.adhesiones > 0 && ` · ${p.adhesiones} vecinos se sumaron`}
                      </p>
                      <a
                        href={`/folio/${p.folio}?unirme=1`}
                        className="mt-2 inline-block text-sm font-medium text-marca-700 underline"
                      >
                        Es el mismo, quiero sumarme
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      {/* ---------------------------------------------------- contacto */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">4. ¿Cómo te avisamos?</legend>
        <p className="text-sm text-tinta-suave">
          Es opcional, pero sin teléfono no podemos avisarte cuando se resuelva
          ni pedirte que califiques. Tu número no se publica nunca.
        </p>

        <Campo
          id="telefono" etiqueta="Teléfono (WhatsApp)"
          ayuda="10 dígitos. Solo lo usa el personal del municipio."
          error={estado.campo === 'telefono' ? estado.error : null}
        >
          <Entrada id="telefono" name="telefono" type="tel" inputMode="numeric"
            autoComplete="tel" placeholder="55 1234 5678" />
        </Campo>

        <Campo id="nombreContacto" etiqueta="Tu nombre">
          <Entrada id="nombreContacto" name="nombreContacto" autoComplete="given-name"
            maxLength={120} placeholder="Como quieras que te llamemos" />
        </Campo>
      </fieldset>

      {estado.error && !estado.campo && <Alerta tipo="error">{estado.error}</Alerta>}

      <div className="border-t border-borde pt-5">
        <BotonEnviar />
        <p className="mt-3 text-xs text-tenue">
          Al enviar aceptas nuestro{' '}
          <a href="/privacidad" className="underline">aviso de privacidad</a>.
        </p>
      </div>
    </form>
  )
}
