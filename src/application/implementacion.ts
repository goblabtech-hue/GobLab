import { prisma } from '@/infrastructure/prisma'
import { avisoPublicado } from '@/application/privacidad'

/**
 * Qué sigue para poner DemosVoz en un municipio.
 *
 * Es una lista de implementación que se revisa sola: cada paso mira la base
 * o la configuración y dice si ya está hecho. Lo que el sistema no puede
 * comprobar (que el jurídico revisó el aviso, que se firmó el contrato) se
 * marca como «lo confirma una persona». El orden es el orden real de una
 * implantación: primero lo que hace que la demo se vea como el municipio,
 * después lo que hace que un reporte real se atienda, al final lo que la
 * pone en internet.
 */

export type EstadoPaso = 'hecho' | 'pendiente' | 'manual'

export type Paso = {
  id: string
  titulo: string
  /** Qué hay que hacer, en una o dos frases. */
  que: string
  /** Quién lo hace: el municipio, Demoscopia, o ambos. */
  quien: 'municipio' | 'demoscopia' | 'ambos'
  estado: EstadoPaso
  /** Lo que se encontró, para que se entienda por qué está como está. */
  detalle: string
  /** Pantalla donde se hace, si está dentro del sistema. */
  href?: string
}

export type Fase = { id: string; titulo: string; para: string; pasos: Paso[] }

const env = (k: string) => (process.env[k] ?? '').trim()

export async function planDeImplementacion(): Promise<{ fases: Fase[]; hechos: number; total: number; pendientes: number }> {
  const [config, dependencias, categoriasActivas, categoriasSinPlazo, colonias, festivos, usuarios, aviso, reportesReales] = await Promise.all([
    prisma.configuracionMunicipio.findUnique({ where: { id: 1 } }),
    prisma.dependencia.findMany({ where: { activa: true }, select: { id: true, nombre: true, correo: true, usuarios: { where: { activo: true }, select: { rol: true } } } }),
    prisma.categoria.count({ where: { activa: true } }),
    prisma.categoria.count({ where: { activa: true, slaDiasHabiles: { lte: 0 } } }),
    prisma.colonia.count(),
    prisma.diaFestivo.count({ where: { fecha: { gte: new Date() } } }),
    prisma.usuario.findMany({ where: { activo: true }, select: { email: true, rol: true, dependenciaId: true, telegramChatIdHash: true, telefonoHash: true } }),
    avisoPublicado(),
    prisma.reporte.count({ where: { origen: { in: ['whatsapp', 'telegram'] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ])

  const demo = env('MODO_DEMO') === 'true'
  const cuentasDemo = usuarios.filter((u) => u.email.endsWith('@municipio.gob.mx')).length
  const sinCorreo = dependencias.filter((d) => !d.correo)
  const sinTitular = dependencias.filter((d) => !d.usuarios.some((u) => u.rol === 'supervisor'))
  const sinCuadrilla = dependencias.filter((d) => !d.usuarios.some((u) => u.rol === 'cuadrilla'))
  const personal = usuarios.filter((u) => u.rol === 'supervisor' || u.rol === 'cuadrilla')
  const conCanal = personal.filter((u) => u.telegramChatIdHash || u.telefonoHash).length
  const avisoConPendientes = aviso ? /PENDIENTE/.test(aviso.contenido) : true

  const fases: Fase[] = [
    {
      id: 'acuerdo', titulo: '1. Acuerdo con el municipio', para: 'Antes de tocar el sistema.',
      pasos: [
        { id: 'contacto', titulo: 'Presentación y demostración', quien: 'demoscopia', estado: 'manual',
          que: 'Enseñar la plataforma con el municipio configurado como demo (nombre, logotipo, sus dependencias). La página /plataforma cuenta el producto; el diagrama de flujo explica el ciclo.',
          detalle: 'Lo confirma una persona.', href: '/plataforma' },
        { id: 'responsable', titulo: 'Nombrar al responsable municipal', quien: 'municipio', estado: 'manual',
          que: 'Una persona del municipio con autoridad para decidir catálogos, plazos y quién entra: normalmente secretaría técnica o sistemas. Es quien lleva esta lista.',
          detalle: 'Lo confirma una persona.' },
        { id: 'convenio', titulo: 'Convenio o contrato', quien: 'ambos', estado: 'manual',
          que: 'Alcance, vigencia, quién opera el servidor, quién es responsable de los datos personales (el municipio) y quién encargado (Demoscopia). Define lo que dirá el aviso de privacidad.',
          detalle: 'Lo confirma una persona.' },
      ],
    },
    {
      id: 'identidad', titulo: '2. Que se vea como el municipio', para: 'Un día. Con esto la demo ya es «su» sistema.',
      pasos: [
        { id: 'datos', titulo: 'Datos del municipio', quien: 'municipio', href: '/admin/municipio',
          estado: config && config.nombre && config.prefijoFolio && config.telEmergencias ? 'hecho' : 'pendiente',
          que: 'Nombre oficial, prefijo del folio (3–4 letras), teléfono de emergencias, centro del mapa y zona horaria.',
          detalle: config ? `${config.nombre} · folios ${config.prefijoFolio}-… · emergencias ${config.telEmergencias}` : 'Sin configuración.' },
        { id: 'logo', titulo: 'Logotipo y tema visual', quien: 'municipio', href: '/admin/municipio',
          estado: config?.logoUrl ? 'hecho' : 'pendiente',
          que: 'El escudo o logotipo del ayuntamiento en PNG con fondo transparente; el sistema genera la versión blanca. Tema: Demoscopia, institucional, federal (guinda/oro) o sobrio.',
          detalle: config?.logoUrl ? `Logotipo cargado · tema «${config.tema}»` : 'Sin logotipo: se muestra el nombre del municipio.' },
        { id: 'dependencias', titulo: 'Dependencias reales con correo institucional', quien: 'municipio', href: '/admin/dependencias',
          estado: dependencias.length > 0 && sinCorreo.length === 0 ? 'hecho' : 'pendiente',
          que: 'Las áreas que resuelven reportes, tal como se llaman en el organigrama, con el correo al que deben llegar los avisos, y su ícono y color.',
          detalle: dependencias.length === 0 ? 'Ninguna dependencia.' : sinCorreo.length ? `${dependencias.length} dependencias; ${sinCorreo.length} sin correo: ${sinCorreo.map((d) => d.nombre).join(', ')}.` : `${dependencias.length} dependencias, todas con correo.` },
        { id: 'categorias', titulo: 'Categorías que el municipio atiende', quien: 'municipio', href: '/admin/categorias',
          estado: categoriasActivas > 0 ? 'hecho' : 'pendiente',
          que: 'Del catálogo de 44 tipos de problema, activar los que este municipio atiende y asignar cada uno a su dependencia. Lo que no se activa, la gente no lo puede reportar.',
          detalle: `${categoriasActivas} categorías activas.` },
        { id: 'plazos', titulo: 'Plazos de atención acordados con cada área', quien: 'municipio', href: '/admin/plazos',
          estado: categoriasActivas > 0 && categoriasSinPlazo === 0 ? 'hecho' : 'pendiente',
          que: 'Días hábiles comprometidos por categoría. Es la promesa pública: sale en el tablero y se mide. Cada titular debe firmar el suyo; un plazo que nunca se cumple es peor que uno más largo que sí.',
          detalle: categoriasSinPlazo ? `${categoriasSinPlazo} categorías activas sin plazo.` : 'Todas las categorías activas tienen plazo. Falta que cada titular lo valide (lo confirma una persona).' },
        { id: 'colonias', titulo: 'Colonias del municipio', quien: 'ambos', href: '/admin/colonias',
          estado: colonias >= 10 ? 'hecho' : 'pendiente',
          que: 'Importar el catálogo oficial de Correos de México (SEPOMEX) del municipio: todos los asentamientos con código postal. Es lo que el bot usa cuando no hay GPS y lo que alimenta «Mi colonia».',
          detalle: `${colonias} asentamientos cargados.` },
        { id: 'festivos', titulo: 'Días festivos locales', quien: 'municipio', href: '/admin/festivos',
          estado: festivos > 0 ? 'hecho' : 'pendiente',
          que: 'Los nacionales vienen cargados; agregar la feria, las fiestas patronales y los días que el ayuntamiento no trabaja. No cuentan para los plazos.',
          detalle: `${festivos} festivos por venir en el calendario.` },
      ],
    },
    {
      id: 'personas', titulo: '3. Las personas que lo operan', para: 'Un día. Sin esto, un reporte real no lo atiende nadie.',
      pasos: [
        { id: 'titulares', titulo: 'Un titular por dependencia', quien: 'municipio', href: '/admin/usuarios',
          estado: dependencias.length > 0 && sinTitular.length === 0 ? 'hecho' : 'pendiente',
          que: 'Cuenta de supervisión para cada área con su correo institucional real. Es quien reparte el trabajo y responde por el plazo.',
          detalle: sinTitular.length ? `Sin titular: ${sinTitular.map((d) => d.nombre).join(', ')}.` : 'Todas las dependencias tienen titular.' },
        { id: 'cuadrillas', titulo: 'Cuadrillas de cada área', quien: 'municipio', href: '/admin/usuarios',
          estado: dependencias.length > 0 && sinCuadrilla.length === 0 ? 'hecho' : 'pendiente',
          que: 'Una cuenta por persona o brigada que sale a la calle. Entran desde el teléfono; conviene instalarles la app.',
          detalle: sinCuadrilla.length ? `Sin cuadrilla: ${sinCuadrilla.map((d) => d.nombre).join(', ')}.` : 'Todas las dependencias tienen al menos una cuadrilla.' },
        { id: 'recepcion', titulo: 'Quién cubre recepción', quien: 'municipio', href: '/admin/usuarios',
          estado: usuarios.some((u) => u.rol === 'operador') ? 'hecho' : 'pendiente',
          que: 'La persona (o personas) de atención ciudadana que lee todo lo que llega y decide si se registra. Definir también quién cubre fuera de horario: un reporte por validar no corre plazo.',
          detalle: `${usuarios.filter((u) => u.rol === 'operador').length} cuentas de atención ciudadana.` },
        { id: 'canales', titulo: 'Canales de aviso del personal', quien: 'municipio', href: '/admin/usuarios',
          estado: personal.length > 0 && conCanal === personal.length ? 'hecho' : 'pendiente',
          que: 'Cada titular y cuadrilla vincula su Telegram (código desde /admin/usuarios → «/vincular CÓDIGO» al bot) o su WhatsApp. Sin esto solo reciben correo.',
          detalle: `${conCanal} de ${personal.length} personas de área con Telegram o WhatsApp vinculado.` },
        { id: 'capacitacion', titulo: 'Capacitación por perfil', quien: 'demoscopia', href: '/admin/manuales', estado: 'manual',
          que: 'Una sesión de una hora con recepción y titulares, y media hora con cuadrillas en su teléfono. Los manuales están en el sistema y se imprimen por perfil.',
          detalle: 'Lo confirma una persona.' },
      ],
    },
    {
      id: 'legal', titulo: '4. Lo legal', para: 'Es requisito, no trámite: se recaban teléfonos y fotos de la gente.',
      pasos: [
        { id: 'aviso', titulo: 'Aviso de privacidad revisado por el jurídico', quien: 'municipio', href: '/admin/privacidad',
          estado: aviso && !avisoConPendientes ? 'hecho' : 'pendiente',
          que: 'El borrador describe exactamente lo que el sistema hace con los datos; faltan el domicilio, la Unidad de Transparencia y el fundamento estatal, y la revisión del área jurídica. Se publica una versión y queda en vigor.',
          detalle: !aviso ? 'No hay aviso publicado.' : avisoConPendientes ? `Versión ${aviso.version} publicada, pero todavía con apartados marcados PENDIENTE.` : `Versión ${aviso.version} publicada sin pendientes.` },
        { id: 'datos-abiertos', titulo: 'Decidir qué se publica en datos abiertos', quien: 'municipio', href: '/datos-abiertos', estado: 'manual',
          que: 'El sistema publica reportes sin datos personales (categoría, colonia, estatus, fechas). Confirmar con Transparencia que ese alcance es el que el municipio quiere.',
          detalle: 'Lo confirma una persona.' },
      ],
    },
    {
      id: 'canales', titulo: '5. Los canales por donde reporta la gente', para: 'Telegram el mismo día; WhatsApp toma de 1 a 3 semanas por el trámite con Meta.',
      pasos: [
        { id: 'telegram', titulo: 'Bot de Telegram del municipio', quien: 'ambos',
          estado: env('TELEGRAM_BOT_TOKEN') ? 'hecho' : 'pendiente',
          que: 'Crear el bot con @BotFather a nombre del municipio (p. ej. @ReportesTulaBot) y cargar el token en el servidor. Sin trámite ni costo.',
          detalle: env('TELEGRAM_BOT_TOKEN') ? 'Token configurado.' : 'Sin TELEGRAM_BOT_TOKEN.' },
        { id: 'whatsapp', titulo: 'WhatsApp Business (Meta)', quien: 'ambos',
          estado: env('MESSAGING_DRIVER') === 'whatsapp_cloud' && env('WHATSAPP_TOKEN') ? 'hecho' : 'pendiente',
          que: 'Cuenta de Meta Business verificada a nombre del ayuntamiento, un número dedicado, y aprobación de las plantillas de mensaje. Es el canal que más usa la gente; vale la pena empezar el trámite el primer día.',
          detalle: env('WHATSAPP_TOKEN') ? 'Credenciales de WhatsApp Cloud configuradas.' : 'Sin credenciales de WhatsApp; el sistema usa el simulador o Telegram.' },
        { id: 'correo', titulo: 'Correo saliente del municipio', quien: 'municipio',
          estado: env('SMTP_HOST') && env('SMTP_HOST') !== 'buzon-prueba' ? 'hecho' : 'pendiente',
          que: 'Una cuenta SMTP (p. ej. reportes@municipio.gob.mx) para que los avisos a las áreas salgan de verdad.',
          detalle: env('SMTP_HOST') ? `SMTP: ${env('SMTP_HOST')}` : 'Sin SMTP: los correos no salen.' },
        { id: 'ia', titulo: 'Clasificación automática (opcional)', quien: 'demoscopia',
          estado: env('ANTHROPIC_API_KEY') ? 'hecho' : 'pendiente',
          que: 'Con la llave de la API de Anthropic el bot entiende el texto libre y propone la categoría; sin ella ofrece el menú. No decide nada: recepción sigue siendo humana.',
          detalle: env('ANTHROPIC_API_KEY') ? 'Llave configurada.' : 'Sin llave: el bot usa el menú de categorías.' },
      ],
    },
    {
      id: 'servidor', titulo: '6. En internet', para: 'Un día. Guía completa en DESPLIEGUE.md.',
      pasos: [
        { id: 'dominio', titulo: 'Dominio y servidor', quien: 'demoscopia',
          estado: env('SITIO_URL').startsWith('https://') && !/ngrok|localhost/.test(env('SITIO_URL')) ? 'hecho' : 'pendiente',
          que: 'Un VPS (2 vCPU / 4 GB) con PostgreSQL, HTTPS y el dominio del municipio o un subdominio de demosvoz.com. Respaldos diarios fuera del servidor y una restauración probada.',
          detalle: env('SITIO_URL') ? `SITIO_URL: ${env('SITIO_URL')}` : 'Sin SITIO_URL.' },
        { id: 'secretos', titulo: 'Secretos propios', quien: 'demoscopia', estado: 'manual',
          que: 'AUTH_SECRET, PHONE_ENCRYPTION_KEY y CRON_SECRET generados para esta instalación; nunca los de la demo. La llave de cifrado del teléfono no se puede cambiar después sin migrar los datos.',
          detalle: 'Lo confirma quien despliega.' },
        { id: 'cron', titulo: 'Tareas programadas', quien: 'demoscopia', estado: 'manual',
          que: 'Alertas de vencidos, autocierre a 3 días, recálculo de indicadores y mantenimiento: cuatro cron cada hora contra /api/cron/*.',
          detalle: 'Lo confirma quien despliega.' },
        { id: 'demo-off', titulo: 'Apagar el modo demostración', quien: 'demoscopia',
          estado: !demo ? 'hecho' : 'pendiente',
          que: 'MODO_DEMO=false quita la franja «sitio de demostración» y hace que la raíz sea la página del ciudadano, no la de ventas.',
          detalle: demo ? 'MODO_DEMO=true: la franja sigue encendida.' : 'Modo demostración apagado.' },
        { id: 'cuentas-demo', titulo: 'Borrar las cuentas y los datos de demostración', quien: 'demoscopia', href: '/admin/usuarios',
          estado: cuentasDemo === 0 ? 'hecho' : 'pendiente',
          que: 'Las cuentas @municipio.gob.mx con contraseña conocida y los 660 reportes ficticios. Se arranca con la base limpia y los catálogos reales.',
          detalle: cuentasDemo ? `${cuentasDemo} cuentas de demostración activas.` : 'Sin cuentas de demostración.' },
        { id: 'apps', titulo: 'Apps en las tiendas (opcional)', quien: 'ambos', estado: 'manual',
          que: 'La PWA se instala desde el navegador desde el primer día. Para App Store y Google Play: cuentas de desarrollador a nombre del municipio, íconos y capturas. Lista en TIENDAS.md.',
          detalle: 'Lo confirma una persona.' },
      ],
    },
    {
      id: 'arranque', titulo: '7. Arranque', para: 'La primera semana con reportes reales.',
      pasos: [
        { id: 'piloto', titulo: 'Piloto con una dependencia', quien: 'ambos', estado: 'manual',
          que: 'Una semana con un área (la de más volumen, normalmente Servicios Municipales) antes de anunciar. Sirve para ajustar plazos y ver que los avisos llegan.',
          detalle: 'Lo confirma una persona.' },
        { id: 'primeros', titulo: 'Primeros reportes reales por bot', quien: 'municipio',
          estado: reportesReales > 0 && !demo ? 'hecho' : 'pendiente',
          que: 'Que entren reportes de vecinos por WhatsApp o Telegram y lleguen a recepción. Es la prueba de que todo lo anterior funciona.',
          detalle: demo ? 'En modo demostración no cuenta.' : `${reportesReales} reportes por bot en los últimos 30 días.` },
        { id: 'difusion', titulo: 'Difusión', quien: 'municipio', estado: 'manual',
          que: 'El número de WhatsApp y el enlace en la página del ayuntamiento, redes, recibos de agua y predial. Código QR en las oficinas.',
          detalle: 'Lo confirma una persona.' },
        { id: 'semanal', titulo: 'Reunión semanal con el informe', quien: 'municipio', href: '/ejecutivo/semanal', estado: 'manual',
          que: 'Cada lunes, el informe semanal por dependencia en la mesa de la dirección. Es lo que hace que el sistema cambie cómo se trabaja y no solo cómo se registra.',
          detalle: 'Lo confirma una persona.' },
      ],
    },
  ]

  const todos = fases.flatMap((f) => f.pasos)
  return {
    fases,
    total: todos.length,
    hechos: todos.filter((p) => p.estado === 'hecho').length,
    pendientes: todos.filter((p) => p.estado === 'pendiente').length,
  }
}
