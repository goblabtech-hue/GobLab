/**
 * Los manuales de operación, por perfil.
 *
 * Están escritos contra lo que el sistema hace hoy: cada pantalla, botón y
 * aviso que se menciona existe. Si se cambia una pantalla, se cambia aquí.
 * Están en código y no en la base para que viajen con la versión del
 * sistema: un manual que describe botones que ya no están es peor que ninguno.
 */

export type Tarea = { titulo: string; pasos: string[] }

export type Manual = {
  id: string
  perfil: string
  /** Quién es esta persona en el municipio. */
  quien: string
  /** Por dónde entra. */
  entra: string
  /** Lo que tiene que hacer, en orden de frecuencia. */
  tareas: Tarea[]
  /** Por dónde le llegan los avisos y cuáles. */
  avisos: string[]
  /** Lo que sí puede hacer. */
  puede: string[]
  /** Lo que no, y por qué —para que no lo busque. */
  noPuede: string[]
}

export const MANUALES: Manual[] = [
  {
    id: 'ciudadano',
    perfil: 'Ciudadano',
    quien: 'Cualquier vecino. No necesita cuenta ni contraseña: su teléfono es su identificación.',
    entra: 'WhatsApp o Telegram del municipio, la página pública (/reportar), o la app en el teléfono.',
    tareas: [
      { titulo: 'Levantar un reporte', pasos: [
        'Escribe «hola» al bot (o abre /reportar) y elige «Reportar un problema».',
        'Describe el problema con sus palabras. Si no queda clara la categoría, el bot ofrece una lista corta.',
        'Manda una foto si tiene (opcional) y su ubicación; si no puede mandar ubicación, escribe el nombre de la colonia.',
        'Confirma. Recibe su folio al instante y el mensaje «recibido, en validación».',
        'Cuando recepción lo registra, recibe el plazo comprometido en días hábiles.',
      ] },
      { titulo: 'Consultar y completar un reporte', pasos: [
        'Escribe el folio al bot (o ábrelo en /folio/SU-FOLIO) para ver en qué va.',
        'Mientras esté abierto puede «Agregar una foto» o «Agregar información». Se suman al expediente sin borrar lo anterior.',
        'Si el mismo problema ya lo reportó otro vecino, el bot le ofrece sumarse en vez de duplicarlo.',
      ] },
      { titulo: 'Confirmar que quedó resuelto', pasos: [
        'Cuando la cuadrilla termina, le llega la foto del trabajo con la pregunta «¿Quedó resuelto?».',
        '«Sí, quedó»: califica del 1 al 5 y el reporte se cierra.',
        '«No, sigue igual»: escribe qué falta y el reporte se reabre con plazo nuevo. El área se entera.',
        'Si no contesta en 3 días, el reporte se cierra solo y queda registrado que fue sin respuesta.',
      ] },
      { titulo: 'Ver cómo va el municipio', pasos: [
        '«Cómo vamos» (/tablero): cuánto tarda cada tipo de problema y si se cumple el plazo.',
        '«Mi colonia»: los reportes abiertos y resueltos de su colonia.',
        '«Antes y después»: trabajos terminados con foto.',
      ] },
    ],
    avisos: [
      'Por el mismo canal en que reportó: folio, registro con plazo, asignación, inicio de atención, resolución con foto, y cierre.',
      'Si recepción no registra el reporte, recibe el motivo escrito por la persona que lo revisó.',
    ],
    puede: [
      'Reportar sin cuenta, con foto y ubicación.',
      'Consultar cualquier folio por su número.',
      'Agregar fotos e información a sus reportes abiertos.',
      'Sumarse a un reporte existente en vez de duplicarlo.',
      'Decidir si un reporte se cierra, y calificarlo.',
      'Reabrir una vez si el trabajo no quedó.',
    ],
    noPuede: [
      'Ver el nombre o teléfono de otros vecinos: la página pública nunca los muestra.',
      'Ver el texto o las fotos de un reporte hasta que recepción lo registró, ni de los que se registraron como «no público».',
      'Reabrir dos veces: si vuelve a fallar, levanta un reporte nuevo para que el área lo vea como reincidencia.',
    ],
  },
  {
    id: 'operador',
    perfil: 'Atención ciudadana (operador)',
    quien: 'La persona de ventanilla o del centro de atención. Es la primera que ve todo lo que manda la gente.',
    entra: '/entrar con su correo institucional. Al entrar cae en Recepción.',
    tareas: [
      { titulo: 'Recepción: decidir qué se registra', pasos: [
        'Abre Recepción. El número en el menú es cuántos reportes esperan; se atienden del más viejo al más nuevo.',
        'Lee el texto, mira las fotos y el lugar («ver en el mapa»). Está viendo exactamente lo que mandó el vecino.',
        'Si es un problema municipal real: revisa la categoría (corrígela si no era esa) y pulsa «Registrar». Se va al área y ahí sí se avisa.',
        'Si el problema es real pero el texto o las fotos no se pueden mostrar (groserías, datos de terceros): marca «No mostrar texto ni fotos al público» y registra. El área lo ve completo; el público solo ve categoría, colonia y estatus.',
        'Si no es un problema municipal (venta, insulto sin problema detrás, otro municipio): «No registrar» y escribe el motivo. El vecino lo va a leer tal cual.',
      ] },
      { titulo: 'Capturar un reporte de ventanilla o teléfono', pasos: [
        'Con su sesión abierta, entra a Reportar (/reportar): el mismo formulario que usa la gente.',
        'Captura la descripción con las palabras del vecino, la categoría, la ubicación o colonia, y su teléfono si lo da: por ahí le llegarán los avisos.',
        'Como lo captura personal con sesión, nace registrado con origen «ventanilla»: no pasa por recepción, porque ya lo revisó una persona.',
      ] },
      { titulo: 'Bandeja: mover los reportes', pasos: [
        'Filtra por área, estatus o vencidos. Los vencidos aparecen marcados.',
        'Abre un folio para ver el expediente completo: bitácora, fotos, plazo, quién lo tiene.',
        '«Asignar» a una cuadrilla del área; «Reasignar» a otra dependencia con motivo si se ruteó mal.',
        '«Duplicado» si ya existe uno igual cerca (el sistema sugiere candidatos); «Improcedente» con motivo si no le toca al municipio.',
        '«Ver teléfono» solo cuando necesite llamar al vecino: cada vez que se revela queda en la bitácora con su nombre.',
      ] },
    ],
    avisos: [
      'Ninguno automático: su trabajo es entrar a Recepción. El contador en el menú se actualiza en cada pantalla.',
    ],
    puede: [
      'Registrar, registrar sin publicar, o no registrar lo que llega.',
      'Capturar reportes de ventanilla y teléfono.',
      'Ver todos los reportes de todas las áreas.',
      'Asignar, reasignar, marcar duplicado o improcedente.',
      'Ver el teléfono del vecino (queda registrado).',
    ],
    noPuede: [
      'Resolver un reporte: eso lo hace la cuadrilla con foto, para que la evidencia sea de quien hizo el trabajo.',
      'Ver indicadores ni el informe semanal: son de supervisión y dirección.',
      'Publicar fotos en la galería «Antes y después», ni cambiar catálogos, plazos o usuarios.',
    ],
  },
  {
    id: 'cuadrilla',
    perfil: 'Cuadrilla',
    quien: 'Quien va a la calle a resolver: el chofer de la pipa, el bacheador, el electricista de alumbrado.',
    entra: '/entrar desde su teléfono. Cae en «Mis reportes». Conviene instalar la app (el sistema lo ofrece) para tenerla como ícono.',
    tareas: [
      { titulo: 'Atender un reporte', pasos: [
        'Abre «Mis reportes»: solo ve los que le asignaron, con el plazo de cada uno. Primero los que vencen antes.',
        'Al llegar al lugar pulsa «Empezar». El vecino se entera de que ya van.',
        'Al terminar, toma la foto del trabajo desde la misma pantalla y escribe una nota breve de qué se hizo.',
        '«Marcar resuelto». Sin foto el botón no cierra si la categoría la exige (baches, luminarias, fugas…).',
        'Al vecino le llega la foto con la pregunta de si quedó. Si dice que no, el reporte vuelve a su lista con plazo nuevo.',
      ] },
    ],
    avisos: [
      'WhatsApp o Telegram (el que tenga vinculado en su usuario) y correo: cuando le asignan un reporte, cuando el vecino dice que no quedó, y una vez cuando un reporte suyo se venció.',
    ],
    puede: [
      'Ver sus reportes asignados con dirección, foto del vecino y plazo.',
      'Marcar inicio de atención.',
      'Subir la evidencia y marcar resuelto.',
    ],
    noPuede: [
      'Ver reportes de otros ni la bandeja completa.',
      'Ver el teléfono del vecino: si necesita hablarle, lo pide a su supervisor.',
      'Cerrar un reporte: el cierre lo da el vecino al confirmar, o el sistema a los 3 días.',
      'Reasignarse un reporte ni rechazarlo: si no le toca, avisa a su supervisor para que lo reasigne.',
    ],
  },
  {
    id: 'supervisor',
    perfil: 'Supervisión (titular de área)',
    quien: 'La persona responsable de una dependencia: Obras Públicas, Servicios Municipales, Agua… Ve solo lo de su área.',
    entra: '/entrar. Cae en la Bandeja filtrada a su dependencia.',
    tareas: [
      { titulo: 'Cada mañana: repartir el trabajo', pasos: [
        'Bandeja: lo nuevo de su área está arriba, con el plazo corriendo desde que recepción lo registró.',
        'Abre cada folio y «Asignar» a la cuadrilla que corresponda. A esa persona le llega el aviso al momento.',
        'Si un reporte no es de su área, «Reasignar» con motivo: se va a la otra dependencia y se registra por qué.',
      ] },
      { titulo: 'Vigilar los plazos', pasos: [
        'Filtra «Vencidos». Cada uno ya le avisó una vez por correo y Telegram; aquí se ve el acumulado.',
        'Indicadores → su área: cumplimiento del plazo, días promedio, reabiertos. Es el mismo dato que ve la dirección.',
        'Informe semanal (Indicadores → Semanal): qué resolvió su área la semana pasada, qué porcentaje a tiempo, y los cinco pendientes más viejos.',
      ] },
      { titulo: 'Decidir qué se publica en «Antes y después»', pasos: [
        'Galería: los reportes cerrados de su área con foto de antes y después.',
        '«Publicar» los que sean un buen ejemplo del trabajo; «No publicar» los que no. Solo lo publicado sale en la página pública.',
      ] },
      { titulo: 'Cubrir recepción si le toca', pasos: [
        'Tiene acceso a Recepción con las mismas funciones que atención ciudadana, por si el municipio decide que cada área valide lo suyo o para cubrir fuera de horario.',
      ] },
    ],
    avisos: [
      'Correo institucional del área + su Telegram o WhatsApp: cuando llega un reporte nuevo al área, cuando el vecino dice que no quedó, y cuando un reporte del área se venció.',
    ],
    puede: [
      'Todo lo de atención ciudadana, limitado a su dependencia.',
      'Asignar y reasignar cuadrillas.',
      'Ver indicadores e informe semanal de su área.',
      'Publicar o no en la galería.',
      'Resolver un reporte él mismo con evidencia, si sale a campo.',
    ],
    noPuede: [
      'Ver reportes de otras dependencias.',
      'Cambiar plazos, categorías o usuarios: son decisiones de administración, porque afectan a todas las áreas y a la promesa pública.',
      'Borrar un reporte o su bitácora: nada se borra; se marca improcedente o duplicado con motivo.',
    ],
  },
  {
    id: 'direccion',
    perfil: 'Dirección (presidencia, secretaría)',
    quien: 'Quien responde por el municipio completo. Entra con un usuario de supervisión sin dependencia o de administración: ve todas las áreas.',
    entra: '/entrar. Va directo a Indicadores.',
    tareas: [
      { titulo: 'El lunes: el informe semanal', pasos: [
        'Indicadores → Semanal. Una fila por dependencia: resueltos, cuántos a tiempo, cumplimiento, días promedio, cuántos entraron, cuántos quedan pendientes y cuántos ya vencieron.',
        'Cambia de semana con las flechas para comparar. La semana en curso se marca como parcial.',
        'Cada fila abre los cinco pendientes más viejos del área: es la lista para la reunión con el titular.',
      ] },
      { titulo: 'Durante la semana: indicadores', pasos: [
        'Indicadores: cumplimiento global y por área, tiempo de atención, reaperturas, mal ruteo (reasignados) y calificación de los vecinos.',
        'El tablero público («Cómo vamos») muestra a los vecinos el mismo dato, sin nombres. Lo que se promete ahí es lo que se mide aquí.',
      ] },
    ],
    avisos: [
      'Ninguno por defecto. Si quiere recibir los vencidos de un área, se le da un usuario de supervisión de esa área.',
    ],
    puede: [
      'Ver indicadores e informe semanal de todas las áreas.',
      'Ver la bandeja completa y cualquier expediente.',
    ],
    noPuede: [
      'Nada más si el usuario es de supervisión sin área; si es de administración, todo lo del apartado siguiente.',
    ],
  },
  {
    id: 'admin',
    perfil: 'Administración del sistema',
    quien: 'Quien configura la plataforma para el municipio. Normalmente una persona de sistemas o de la secretaría técnica.',
    entra: '/entrar. Tiene todos los menús.',
    tareas: [
      { titulo: 'Arrancar el municipio (una vez)', pasos: [
        'Datos del municipio: nombre, prefijo del folio, teléfono de emergencias, centro del mapa, logotipo y tema visual.',
        'Dependencias: las áreas reales, su titular y su correo institucional. Ahí llegan los avisos.',
        'Categorías: activa del catálogo las que el municipio atiende y asigna cada una a su dependencia. Cada categoría activa necesita plazo.',
        'Plazos de atención: días hábiles comprometidos por categoría. Es la promesa pública: se ve en el tablero y se mide.',
        'Colonias: importa el catálogo de Correos de México del municipio (archivo oficial) o captura a mano.',
        'Días festivos: los que no cuentan para el plazo. Los nacionales vienen cargados; agrega los locales (feria, fiestas patronales).',
        'Aviso de privacidad: pega o sube el documento revisado por el jurídico. Se versiona; una sola está en vigor.',
      ] },
      { titulo: 'Dar de alta a las personas', pasos: [
        'Usuarios: nombre, correo institucional, perfil (atención, cuadrilla, supervisión, administración) y dependencia para cuadrillas y supervisores.',
        'Teléfono para avisos por WhatsApp; «Vincular Telegram» genera un código que la persona escribe al bot (/vincular CÓDIGO) desde su teléfono. Vence en 15 minutos.',
        'Para dar de baja a alguien, desmarca «Cuenta activa»: pierde el acceso sin borrar lo que resolvió. Sus reportes abiertos se reasignan desde la bandeja.',
      ] },
      { titulo: 'Mantener', pasos: [
        'Revisa Plazos con el cumplimiento real al lado antes de cambiar una promesa: un plazo que nunca se cumple es peor que uno más largo que sí.',
        'Los cambios de plazos y festivos afectan a los reportes nuevos; los ya levantados conservan su fecha límite.',
        'Este manual: está en el código del sistema y describe la versión instalada. Se actualiza con cada versión.',
      ] },
    ],
    avisos: [
      'Los del perfil de supervisión si además tiene dependencia; si no, ninguno automático.',
    ],
    puede: [
      'Todo lo de los demás perfiles, en todas las áreas.',
      'Configurar municipio, catálogos, plazos, festivos, privacidad, tema y logotipo.',
      'Crear, editar y desactivar usuarios; vincular sus canales de aviso.',
    ],
    noPuede: [
      'Borrar reportes ni editar la bitácora: el expediente es de solo escritura para todos, incluida administración. Es lo que lo hace confiable.',
      'Ver contraseñas: se cambian, no se leen.',
    ],
  },
]

/** Quién puede qué, en una sola tabla. ✓ sí · área = solo su dependencia. */
export type Permiso = { funcion: string; ciudadano: string; operador: string; cuadrilla: string; supervisor: string; admin: string }
export const MATRIZ: Permiso[] = [
  { funcion: 'Reportar (bot, web, app)', ciudadano: '✓', operador: '✓ ventanilla, nace registrado', cuadrilla: '', supervisor: '✓ ventanilla', admin: '✓ ventanilla' },
  { funcion: 'Consultar cualquier folio', ciudadano: '✓ sin datos personales', operador: '✓', cuadrilla: 'los suyos', supervisor: 'área', admin: '✓' },
  { funcion: 'Recepción: registrar o no', ciudadano: '', operador: '✓', cuadrilla: '', supervisor: '✓', admin: '✓' },
  { funcion: 'Asignar / reasignar', ciudadano: '', operador: '✓', cuadrilla: '', supervisor: 'área', admin: '✓' },
  { funcion: 'Marcar duplicado / improcedente', ciudadano: '', operador: '✓', cuadrilla: '', supervisor: 'área', admin: '✓' },
  { funcion: 'Empezar atención y resolver con foto', ciudadano: '', operador: '', cuadrilla: '✓', supervisor: 'área', admin: '✓' },
  { funcion: 'Confirmar que quedó, calificar, reabrir', ciudadano: '✓', operador: '', cuadrilla: '', supervisor: '', admin: '' },
  { funcion: 'Agregar fotos e información a un reporte', ciudadano: 'los suyos', operador: '', cuadrilla: 'evidencia', supervisor: '', admin: '' },
  { funcion: 'Ver el teléfono del vecino', ciudadano: '', operador: '✓ queda registrado', cuadrilla: '', supervisor: '✓ queda registrado', admin: '✓ queda registrado' },
  { funcion: 'Indicadores e informe semanal', ciudadano: 'tablero público', operador: '', cuadrilla: '', supervisor: 'área', admin: '✓' },
  { funcion: 'Publicar en «Antes y después»', ciudadano: '', operador: '', cuadrilla: '', supervisor: 'área', admin: '✓' },
  { funcion: 'Catálogos, plazos, festivos, privacidad', ciudadano: '', operador: '', cuadrilla: '', supervisor: '', admin: '✓' },
  { funcion: 'Usuarios y canales de aviso', ciudadano: '', operador: '', cuadrilla: '', supervisor: '', admin: '✓' },
  { funcion: 'Borrar reportes o bitácora', ciudadano: '', operador: '', cuadrilla: '', supervisor: '', admin: 'nadie' },
]
