import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/infrastructure/auth'
import { prisma } from '@/infrastructure/prisma'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { inicioPorRol } from '@/domain/presentacion'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Alerta } from '@/components/ui/alerta'
import { FormularioLogin } from './formulario'
import { entrarComoDemo } from './acciones'
import { SelloDependencia } from '@/components/sello-dependencia'
import { ROL } from '@/domain/presentacion'

export const metadata = { title: 'Entrar al sistema' }

export default async function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  const { motivo } = await searchParams
  const municipio = await obtenerConfiguracion()
  const sesion = await auth()

  if (sesion?.user) {
    // Solo se reenvía adentro si la cuenta sigue siendo válida; si no, se deja
    // ver el formulario con la explicación.
    const vigente = await prisma.usuario.findUnique({
      where: { id: sesion.user.id },
      select: { rol: true, activo: true },
    })
    if (vigente?.activo) redirect(inicioPorRol(vigente.rol))
  }

  const demo = process.env.MODO_DEMO === 'true'
  // En la demostración se entra con un clic: nadie tiene que recordar cuentas
  // para enseñar el sistema. Un perfil por tipo, más el titular de cada área.
  const perfilesDemo = demo
    ? await prisma.usuario.findMany({
        where: { activo: true, email: { endsWith: '@municipio.gob.mx' }, NOT: { email: { contains: '2@' } } },
        orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, email: true, rol: true, dependencia: { select: { nombre: true, icono: true, color: true } } },
      })
    : []
  const generales = perfilesDemo.filter((u) => !u.dependencia)
  // Un titular y una cuadrilla por área: las cuentas genéricas supervisor@ y
  // cuadrilla@ duplican a Servicios Municipales y solo estorban aquí.
  const porArea = perfilesDemo.filter((u) => u.dependencia && u.rol === 'supervisor' && !u.email.startsWith('supervisor'))
  const cuadrillas = perfilesDemo.filter((u) => u.dependencia && u.rol === 'cuadrilla' && !u.email.startsWith('cuadrilla@'))
  const corto = (nombre: string) => nombre.replace(/^(Dirección|Secretaría|Unidad) de /, '').split(/,| · /)[0]!

  return (
    <main id="contenido" className="flex flex-1 items-center justify-center p-4">
      <div className={`w-full ${demo ? 'max-w-3xl' : 'max-w-sm'}`}>
        <Link
          href="/inicio"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al sitio ciudadano
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Entrar al sistema</h1>
        <p className="mt-1 mb-6 text-sm text-tinta-suave">
          Acceso para personal de {municipio.nombre}. Si eres ciudadano no
          necesitas cuenta: puedes reportar y consultar tu folio directamente.
        </p>

        {motivo === 'cuenta-inactiva' && (
          <Alerta tipo="aviso" titulo="Tu sesión ya no está activa" className="mb-4">
            Tu cuenta fue desactivada o dada de baja. Si crees que es un error,
            habla con la persona que administra el sistema.
          </Alerta>
        )}

        {demo ? (
          <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
            <div className="space-y-5">
              <Tarjeta><TarjetaCuerpo>
                <p className="text-sm font-semibold">Entrar con un clic</p>
                <p className="mt-0.5 mb-3 text-xs text-tinta-suave">Sitio de demostración: elige con qué perfil quieres ver el sistema.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {generales.map((u) => (
                    <form key={u.id} action={entrarComoDemo}>
                      <input type="hidden" name="email" value={u.email} />
                      <button type="submit" className="flex w-full items-center gap-3 rounded-lg border border-borde bg-papel p-3 text-left transition-colors hover:border-marca-200 hover:bg-marca-50/40">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-sm font-bold text-marca-700">{u.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{ROL[u.rol] ?? u.rol}</span>
                          <span className="block truncate text-xs text-tinta-suave">{u.nombre}</span>
                        </span>
                      </button>
                    </form>
                  ))}
                </div>
              </TarjetaCuerpo></Tarjeta>

              <Tarjeta><TarjetaCuerpo>
                <p className="text-sm font-semibold">Como titular de una dependencia</p>
                <p className="mt-0.5 mb-3 text-xs text-tinta-suave">Cada uno ve solo su área: sus asignados, resultados y tablero.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {porArea.map((u) => (
                    <form key={u.id} action={entrarComoDemo}>
                      <input type="hidden" name="email" value={u.email} />
                      <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg border border-borde bg-papel px-3 py-2 text-left text-sm transition-colors hover:border-marca-200 hover:bg-marca-50/40">
                        <SelloDependencia dependencia={u.dependencia!} tamano="mediano" />
                        <span className="min-w-0 truncate" title={u.dependencia!.nombre}>{corto(u.dependencia!.nombre)}</span>
                      </button>
                    </form>
                  ))}
                </div>
                {cuadrillas.length > 0 && (
                  <details className="mt-3 text-xs text-tinta-suave">
                    <summary className="cursor-pointer">Como cuadrilla de un área ({cuadrillas.length})</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cuadrillas.map((u) => (
                        <form key={u.id} action={entrarComoDemo}>
                          <input type="hidden" name="email" value={u.email} />
                          <button type="submit" className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-papel px-2.5 py-1 hover:bg-lienzo">
                            <SelloDependencia dependencia={u.dependencia!} />{u.nombre.replace('Cuadrilla de ', '')}
                          </button>
                        </form>
                      ))}
                    </div>
                  </details>
                )}
              </TarjetaCuerpo></Tarjeta>
            </div>

            <Tarjeta className="self-start"><TarjetaCuerpo>
              <p className="mb-3 text-sm font-semibold">O con correo y contraseña</p>
              <FormularioLogin />
            </TarjetaCuerpo></Tarjeta>
          </div>
        ) : (
          <Tarjeta>
            <TarjetaCuerpo>
              <FormularioLogin />
            </TarjetaCuerpo>
          </Tarjeta>
        )}
      </div>
    </main>
  )
}
