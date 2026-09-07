'use server'

import { AuthError } from 'next-auth'
import { z } from 'zod'
import { primerError } from '@/domain/validacion'
import { signIn, signOut } from '@/infrastructure/auth'

const schema = z.object({
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export type EstadoLogin = { error?: string }

export async function entrar(
  _previo: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const parsed = schema.safeParse({
    email: datos.get('email'),
    password: datos.get('password'),
  })
  if (!parsed.success) {
    return { error: primerError(parsed.error) }
  }

  try {
    // /ir decide a qué pantalla mandar a cada rol
    await signIn('credentials', { ...parsed.data, redirectTo: '/ir' })
    return {}
  } catch (e) {
    if (e instanceof AuthError) {
      // Mensaje único a propósito: decir "ese correo no existe" permitiría
      // enumerar cuentas del municipio.
      return { error: 'Correo o contraseña incorrectos.' }
    }
    throw e // los redirect() de Next viajan como excepción; deben propagarse
  }
}

export async function salir() {
  await signOut({ redirectTo: '/entrar' })
}
