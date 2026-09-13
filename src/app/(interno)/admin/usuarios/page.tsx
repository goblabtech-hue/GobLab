import { prisma } from '@/infrastructure/prisma'
import { Insignia } from '@/components/ui/insignia'
import { ROL } from '@/domain/presentacion'
import { Catalogo } from '../catalogo'
import { guardarUsuario } from '../acciones'
import { VincularTelegram } from './vincular'

export const metadata = { title: 'Usuarios' }

export default async function PaginaUsuarios() {
  const [usuarios, dependencias] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { dependencia: { select: { nombre: true } } },
    }),
    prisma.dependencia.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } }),
  ])

  return (
    <Catalogo
      titulo="Usuarios"
      descripcion="Cuentas del personal municipal. Al editar, deja la contraseña vacía para conservar la actual. Desactivar una cuenta le quita el acceso sin borrar lo que esa persona ya resolvió. Cada persona recibe avisos de los reportes que le tocan por los canales que tenga conectados: correo siempre; Telegram y WhatsApp si los vincula."
      etiquetaNuevo="Nueva cuenta"
      encabezados={['Persona', 'Perfil', 'Dependencia', 'Avisos', 'Estado']}
      filas={usuarios.map((u) => ({
        id: u.id,
        valores: {
          nombre: u.nombre, email: u.email, rol: u.rol,
          dependenciaId: u.dependenciaId, activo: u.activo,
          // El teléfono no se saca de la base a la pantalla. Si hay uno, el
          // campo va vacío y escribir otro lo cambia.
          telefono: '',
        },
        celdas: [
          <div key="p">
            <p className="font-medium">{u.nombre}</p>
            <p className="text-xs text-tinta-suave">{u.email}</p>
          </div>,
          <Insignia key="r" tono="marca">{ROL[u.rol] ?? u.rol}</Insignia>,
          u.dependencia?.nombre ?? <span key="d" className="text-tenue">Todas</span>,
          <div key="a" className="space-y-1">
            <VincularTelegram userId={u.id} vinculado={Boolean(u.telegramChatIdHash)} />
            <p className="text-xs text-tinta-suave">
              {u.telefonoHash ? 'WhatsApp ✓' : <span className="text-tenue">sin WhatsApp</span>}
            </p>
          </div>,
          u.activo
            ? <Insignia key="e" tono="verde">Activa</Insignia>
            : <Insignia key="e">Sin acceso</Insignia>,
        ],
      }))}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre completo', tipo: 'texto', requerido: true },
        { nombre: 'email', etiqueta: 'Correo', tipo: 'texto', requerido: true },
        { nombre: 'rol', etiqueta: 'Perfil', tipo: 'select', requerido: true,
          opciones: (['operador', 'cuadrilla', 'supervisor', 'admin'] as const).map((r) => ({ valor: r, texto: ROL[r] ?? r })) },
        { nombre: 'dependenciaId', etiqueta: 'Dependencia', tipo: 'select',
          ayuda: 'Déjalo vacío para que vea todas las dependencias.',
          opciones: dependencias.map((d) => ({ valor: d.id, texto: d.nombre })) },
        { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password',
          ayuda: 'Mínimo 8 caracteres. Al editar, vacío = no cambiarla.' },
        { nombre: 'telefono', etiqueta: 'WhatsApp (10 dígitos)', tipo: 'texto',
          ayuda: 'Para avisarle de reportes nuevos, reabiertos y vencidos. Vacío = sin cambio.' },
        { nombre: 'activo', etiqueta: 'Cuenta activa', tipo: 'checkbox' },
      ]}
      accion={guardarUsuario}
    />
  )
}
