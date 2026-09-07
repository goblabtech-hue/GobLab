import Link from 'next/link'
import { Search, AlertTriangle } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { semaforo } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS, ESTATUS_ABIERTOS, ORIGEN, PRIORIDAD, SEMAFORO } from '@/domain/presentacion'
import { fecha, haceCuanto, numero } from '@/domain/formato'
import { Tarjeta } from '@/components/ui/tarjeta'
import { cargaPorArea } from '@/application/reportes'
import { ResumenAreas } from './areas'
import { Insignia } from '@/components/ui/insignia'
import { Boton } from '@/components/ui/boton'
import { Entrada, Selector } from '@/components/ui/campo'
import type { EstatusReporte, Prisma } from '@/generated/prisma/client'

export const metadata = { title: 'Bandeja de reportes' }
export const dynamic = 'force-dynamic'

const POR_PAGINA = 40

function param(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

export default async function PaginaBandeja({ searchParams }: PageProps<'/bandeja'>) {
  const usuario = await requerirRol('operador', 'supervisor', 'admin')
  const sp = await searchParams

  const q = param(sp.q).trim()
  // Sin filtro explícito, la bandeja abre en lo que hay que atender. Mostrar
  // todo por omisión ponía reportes cerrados hace dos años en los primeros
  // renglones, que es justo lo que nadie necesita ver al llegar.
  const fEstatus = 'estatus' in sp ? param(sp.estatus) : 'abiertos'
  const fCategoria = param(sp.categoria)
  const fColonia = param(sp.colonia)
  const fDependencia = param(sp.dependencia)
  const fPrioridad = param(sp.prioridad)
  const fOrigen = param(sp.origen)
  const soloVencidos = param(sp.vencidos) === '1'
  const pagina = Math.max(1, Number(param(sp.p)) || 1)

  const where: Prisma.ReporteWhereInput = {
    ...(fEstatus === 'abiertos'
      ? { estatus: { in: ESTATUS_ABIERTOS } }
      : fEstatus ? { estatus: fEstatus as EstatusReporte } : {}),
    ...(fCategoria ? { categoriaId: Number(fCategoria) } : {}),
    ...(fColonia ? { coloniaId: Number(fColonia) } : {}),
    ...(fDependencia ? { dependenciaId: Number(fDependencia) } : {}),
    ...(fPrioridad ? { prioridad: fPrioridad as 'normal' | 'alta' | 'urgente' } : {}),
    ...(fOrigen ? { origen: fOrigen as 'whatsapp' | 'web' | 'telefono' | 'ventanilla' } : {}),
    ...(soloVencidos ? { estatus: { in: ESTATUS_ABIERTOS }, fechaLimite: { lt: new Date() } } : {}),
    ...(q
      ? {
          OR: [
            { folio: { contains: q.toUpperCase() } },
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { direccionTexto: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    // Un supervisor solo ve lo de su dependencia; operadores y admin ven todo.
    ...(usuario.rol === 'supervisor' && usuario.dependenciaId
      ? { dependenciaId: usuario.dependenciaId }
      : {}),
  }

  const [reportes, total, categorias, colonias, dependencias, festivos, vencidos, areas] =
    await Promise.all([
      prisma.reporte.findMany({
        where,
        orderBy: [{ prioridad: 'desc' }, { fechaLimite: 'asc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true, folio: true, descripcion: true, estatus: true, prioridad: true,
          origen: true, createdAt: true, fechaLimite: true,
          categoria: { select: { nombre: true } },
          colonia: { select: { nombre: true } },
          dependencia: { select: { nombre: true } },
          asignadoA: { select: { nombre: true } },
          _count: { select: { adhesiones: true } },
        },
      }),
      prisma.reporte.count({ where }),
      prisma.categoria.findMany({ orderBy: { orden: 'asc' }, select: { id: true, nombre: true } }),
      prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      prisma.dependencia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      cargarFestivos(),
      prisma.reporte.count({
        where: { estatus: { in: ESTATUS_ABIERTOS }, fechaLimite: { lt: new Date() } },
      }),
      // Un supervisor solo ve la carga de su área; operación y administración,
      // la de todas.
      cargaPorArea(usuario.rol === 'supervisor' ? usuario.dependenciaId : null),
    ])

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Bandeja de reportes</h1>
        <p className="text-sm text-tinta-suave">
          {numero(total)} {total === 1 ? 'reporte' : 'reportes'}
          {fEstatus === 'abiertos' && ' abiertos'}
        </p>
      </div>

      <ResumenAreas areas={areas} />

      {vencidos > 0 && !soloVencidos && (
        <Link href="/bandeja?vencidos=1" className="block">
          <div className="flex items-center gap-2.5 rounded-lg border border-rojo-600/20 bg-rojo-50 p-3 text-sm text-rojo-600 hover:brightness-98">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>
              Hay <strong>{numero(vencidos)}</strong> reportes abiertos que ya pasaron
              su fecha límite. Verlos →
            </span>
          </div>
        </Link>
      )}

      {/* Filtros por GET: la búsqueda queda en la URL y se puede compartir o guardar. */}
      <Tarjeta>
        <form method="get" className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" aria-hidden />
            <Entrada
              name="q" defaultValue={q} className="pl-9"
              placeholder="Buscar por folio, descripción o dirección"
              aria-label="Buscar"
            />
          </div>

          <Selector name="estatus" defaultValue={fEstatus} aria-label="Estatus">
            <option value="abiertos">Solo abiertos</option>
            <option value="">Todos los estatus</option>
            {Object.entries(ESTATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.interno}</option>
            ))}
          </Selector>

          <Selector name="prioridad" defaultValue={fPrioridad} aria-label="Prioridad">
            <option value="">Toda prioridad</option>
            {Object.entries(PRIORIDAD).map(([k, v]) => (
              <option key={k} value={k}>{v.texto}</option>
            ))}
          </Selector>

          <Selector name="categoria" defaultValue={fCategoria} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Selector>

          <Selector name="colonia" defaultValue={fColonia} aria-label="Colonia">
            <option value="">Todas las colonias</option>
            {colonias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Selector>

          <Selector name="dependencia" defaultValue={fDependencia} aria-label="Dependencia">
            <option value="">Todas las dependencias</option>
            {dependencias.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Selector>

          <div className="flex gap-2">
            <Selector name="origen" defaultValue={fOrigen} aria-label="Origen" className="flex-1">
              <option value="">Todos los canales</option>
              {Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selector>
            <Boton type="submit">Filtrar</Boton>
          </div>
        </form>
      </Tarjeta>

      {/* Tabla en pantallas grandes, tarjetas en celular. */}
      <Tarjeta className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Folio</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Reporte</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Estatus</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Vence</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Asignado a</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Canal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {reportes.map((r) => {
                const abierto = ESTATUS_ABIERTOS.includes(r.estatus)
                const luz = abierto ? semaforo(r.fechaLimite, festivos) : null
                return (
                  <tr key={r.id} className="hover:bg-lienzo/60">
                    <td className="px-4 py-3 align-top">
                      <Link href={`/bandeja/${r.folio}`} className="font-mono text-xs font-medium text-marca-700 underline">
                        {r.folio}
                      </Link>
                      {r.prioridad !== 'normal' && (
                        <div className="mt-1">
                          <Insignia tono={PRIORIDAD[r.prioridad].tono}>{PRIORIDAD[r.prioridad].texto}</Insignia>
                        </div>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3 align-top">
                      <p className="font-medium">{r.categoria.nombre}</p>
                      <p className="truncate text-xs text-tinta-suave">{r.descripcion}</p>
                      <p className="mt-0.5 text-xs text-tenue">
                        {r.colonia?.nombre ?? 'Sin colonia'} · {r.dependencia.nombre}
                        {r._count.adhesiones > 0 && ` · ${r._count.adhesiones} vecinos`}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Insignia tono={ESTATUS[r.estatus].tono}>{ESTATUS[r.estatus].interno}</Insignia>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {luz ? (
                        <>
                          <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>
                          <p className="mt-1 text-xs text-tenue">{fecha(r.fechaLimite)}</p>
                        </>
                      ) : (
                        <span className="text-tenue">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.asignadoA?.nombre ?? <span className="text-tenue">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p>{ORIGEN[r.origen]}</p>
                      <p className="text-xs text-tenue">{haceCuanto(r.createdAt)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-borde md:hidden">
          {reportes.map((r) => {
            const abierto = ESTATUS_ABIERTOS.includes(r.estatus)
            const luz = abierto ? semaforo(r.fechaLimite, festivos) : null
            return (
              <li key={r.id}>
                <Link href={`/bandeja/${r.folio}`} className="block p-4 hover:bg-lienzo/60">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-marca-700">{r.folio}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Insignia tono={ESTATUS[r.estatus].tono}>{ESTATUS[r.estatus].interno}</Insignia>
                      {luz && <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>}
                    </div>
                  </div>
                  <p className="mt-1 font-medium">{r.categoria.nombre}</p>
                  <p className="line-clamp-2 text-sm text-tinta-suave">{r.descripcion}</p>
                  <p className="mt-1 text-xs text-tenue">
                    {r.colonia?.nombre ?? 'Sin colonia'} · {ORIGEN[r.origen]} · {haceCuanto(r.createdAt)}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>

        {reportes.length === 0 && (
          <p className="px-4 py-12 text-center text-tinta-suave">
            No hay reportes con esos filtros.
          </p>
        )}
      </Tarjeta>

      {paginas > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
          <PaginaEnlace sp={sp} p={pagina - 1} deshabilitado={pagina <= 1}>Anteriores</PaginaEnlace>
          <span className="text-tinta-suave">Página {pagina} de {paginas}</span>
          <PaginaEnlace sp={sp} p={pagina + 1} deshabilitado={pagina >= paginas}>Siguientes</PaginaEnlace>
        </nav>
      )}
    </div>
  )
}

function PaginaEnlace({
  sp, p, deshabilitado, children,
}: {
  sp: Record<string, string | string[] | undefined>
  p: number
  deshabilitado: boolean
  children: React.ReactNode
}) {
  if (deshabilitado) return <span className="text-tenue">{children}</span>
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v && k !== 'p') qs.set(k, v)
  }
  qs.set('p', String(p))
  return <Link href={`/bandeja?${qs}`} className="font-medium text-marca-700 underline">{children}</Link>
}
