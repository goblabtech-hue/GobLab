import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { inicioPorRol } from '@/lib/presentacion'

/** Punto de aterrizaje tras el login: manda a cada rol a su pantalla. */
export default async function Ir() {
  const sesion = await auth()
  redirect(sesion?.user ? inicioPorRol(sesion.user.rol) : '/entrar')
}
