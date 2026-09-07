import NextAuth from 'next-auth'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { authConfig } from '@/infrastructure/auth.config'

/**
 * Next 16 sustituyó `middleware.ts` por `proxy.ts` y exige una función
 * exportada (no un const destructurado), de ahí el wrapper explícito.
 * Solo decide "pasa / no pasa"; el permiso fino por rol lo aplica cada
 * pantalla con requerirRol(), que sí puede consultar la base de datos.
 */
const { auth } = NextAuth(authConfig)

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return (auth as unknown as (
    req: NextRequest,
    ev: NextFetchEvent,
  ) => ReturnType<typeof auth>)(request, event)
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|uploads|favicon.ico|.*\\.png$).*)'],
}
