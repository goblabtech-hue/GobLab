import type { DefaultSession, NextAuthConfig } from 'next-auth'
import type { Rol } from '@/generated/prisma/enums'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      rol: Rol
      dependenciaId: number | null
    } & DefaultSession['user']
  }
  interface User {
    rol: Rol
    dependenciaId: number | null
  }
}

/**
 * Configuración compartida entre el proxy (Edge) y el servidor (Node).
 *
 * Los callbacks `jwt` y `session` viven AQUÍ, no en auth.ts: el proxy crea su
 * propia instancia de NextAuth y sin ellos el objeto de sesión que recibe no
 * trae `rol`, así que toda ruta interna se veía como no autorizada. Solo la
 * verificación de contraseña (Prisma + bcrypt) se queda en auth.ts, porque no
 * puede correr en Edge.
 */

export const RUTAS_PROTEGIDAS: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: '/bandeja', roles: ['operador', 'supervisor', 'admin'] },
  { prefijo: '/cuadrilla', roles: ['cuadrilla', 'supervisor', 'admin'] },
  { prefijo: '/ejecutivo', roles: ['supervisor', 'admin'] },
  { prefijo: '/admin', roles: ['admin'] },
]

export const authConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/entrar' },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const regla = RUTAS_PROTEGIDAS.find((r) =>
        request.nextUrl.pathname.startsWith(r.prefijo),
      )
      if (!regla) return true

      const rol = auth?.user?.rol
      if (!rol) return false // sin sesión: NextAuth manda a /entrar

      // Con sesión pero sin permiso se deja pasar: la pantalla muestra un
      // mensaje claro de "no tienes acceso" en vez de rebotar al login, que
      // haría creer que la contraseña falló.
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.rol = user.rol
        token.dependenciaId = user.dependenciaId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.rol = token.rol as Rol
      session.user.dependenciaId = token.dependenciaId as number | null
      return session
    },
  },
} satisfies NextAuthConfig
