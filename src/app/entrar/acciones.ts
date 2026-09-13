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

/**
 * Entrar con un clic como alguno de los perfiles de demostración.
 *
 * Solo existe con MODO_DEMO=true: en una instalación real no hay cuentas de
 * demostración y esta acción no hace nada. La contraseña no viaja por el
 * formulario: es la que sembró el seed, y solo se acepta para correos
 * @municipio.gob.mx, que son los de la demo.
 */
export async function entrarComoDemo(datos: FormData) {
  if (process.env.MODO_DEMO !== 'true') return
  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email.endsWith('@municipio.gob.mx')) return
  await signIn('credentials', { email, password: process.env.SEED_PASSWORD ?? 'Demo1234!', redirectTo: '/ir' })
}

export async function salir() {
  await signOut({ redirectTo: '/entrar' })
}
