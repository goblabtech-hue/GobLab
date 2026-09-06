import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'
import type { Rol } from '@/generated/prisma/enums'

/**
 * Login interno con credenciales (SPEC §8) sobre sesión JWT en cookie
 * httpOnly (SPEC §7). El ciudadano NUNCA pasa por aquí: reporta y consulta
 * su folio sin cuenta (SPEC §3).
 */

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/** Hash de descarte, con el costo correcto, para gastar el mismo tiempo cuando el correo no existe. */
const HASH_SEÑUELO = bcrypt.hashSync('contraseña-que-nadie-usa', 10)

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credencialesSchema.safeParse(raw)
        if (!parsed.success) return null

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
        })
        // Se compara siempre, exista o no el usuario, para no filtrar por
        // tiempo de respuesta qué correos están dados de alta.
        const ok = await bcrypt.compare(
          parsed.data.password,
          usuario?.hashPassword ?? HASH_SEÑUELO,
        )
        if (!ok || !usuario || !usuario.activo) return null

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          dependenciaId: usuario.dependenciaId,
        }
      },
    }),
  ],
})

// ---------------------------------------------------------------- permisos

/** Roles que pueden ver datos de contacto sin enmascarar (SPEC §7). */
export const ROLES_VEN_TELEFONO: Rol[] = ['operador', 'supervisor', 'admin']

export class NoAutorizado extends Error {
  constructor(public readonly estado: 401 | 403 = 403) {
    super(estado === 401 ? 'Necesitas iniciar sesión.' : 'No tienes permiso.')
  }
}

/** Exige sesión con alguno de los roles dados; si no, lanza NoAutorizado. */
export async function requerirRol(...roles: Rol[]) {
  const sesion = await auth()
  if (!sesion?.user) throw new NoAutorizado(401)
  if (roles.length && !roles.includes(sesion.user.rol)) throw new NoAutorizado(403)
  return sesion.user
}

export async function usuarioActual() {
  const sesion = await auth()
  return sesion?.user ?? null
}

export async function hashearPassword(plano: string) {
  return bcrypt.hash(plano, 10)
}
