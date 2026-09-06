/**
 * Catálogos semilla.
 *
 * SPEC §Notas finales: "No inventes datos del municipio". Dependencias y
 * colonias de este archivo son GENÉRICAS y están marcadas como pendientes en
 * PENDIENTES.md — el SPEC §11 lo autoriza explícitamente ("usa nombres reales
 * del municipio si se proporcionan; si no, genéricos").
 * Las categorías y sus SLA sí son las 12 que pide el SPEC §11.
 */

export const DEPENDENCIAS = [
  { nombre: 'Dirección de Servicios Públicos', responsable: 'Titular de Servicios Públicos', telefono: '5555550101' },
  { nombre: 'Dirección de Obras Públicas', responsable: 'Titular de Obras Públicas', telefono: '5555550102' },
  { nombre: 'Organismo de Agua y Drenaje', responsable: 'Titular de Agua y Drenaje', telefono: '5555550103' },
  { nombre: 'Dirección de Movilidad y Vialidad', responsable: 'Titular de Movilidad', telefono: '5555550104' },
  { nombre: 'Dirección de Medio Ambiente y Ecología', responsable: 'Titular de Medio Ambiente', telefono: '5555550105' },
] as const

type CatSemilla = {
  slug: string
  nombre: string
  icono: string
  descripcionCorta: string
  slaDiasHabiles: number
  dependencia: number // índice en DEPENDENCIAS
  requiereEvidencia?: boolean
}

/** Las 12 categorías del SPEC §11, en lenguaje ciudadano (SPEC §4.4). */
export const CATEGORIAS: CatSemilla[] = [
  { slug: 'bache', nombre: 'Bache en la calle', icono: 'construction', descripcionCorta: 'Hoyos o hundimientos en el pavimento', slaDiasHabiles: 5, dependencia: 1 },
  { slug: 'luminaria', nombre: 'Luminaria apagada', icono: 'lightbulb-off', descripcionCorta: 'Lámparas del alumbrado público que no encienden', slaDiasHabiles: 3, dependencia: 0 },
  { slug: 'fuga-agua', nombre: 'Fuga de agua', icono: 'droplets', descripcionCorta: 'Agua saliendo de tuberías, tomas o la calle', slaDiasHabiles: 2, dependencia: 2 },
  { slug: 'basura', nombre: 'Basura acumulada', icono: 'trash-2', descripcionCorta: 'Montones de basura en vía pública', slaDiasHabiles: 2, dependencia: 0 },
  { slug: 'arbol-riesgo', nombre: 'Árbol caído o en riesgo', icono: 'tree-deciduous', descripcionCorta: 'Ramas o árboles que pueden caer', slaDiasHabiles: 4, dependencia: 4 },
  { slug: 'banqueta', nombre: 'Banqueta dañada', icono: 'footprints', descripcionCorta: 'Banquetas rotas, levantadas o con hoyos', slaDiasHabiles: 10, dependencia: 1 },
  { slug: 'semaforo', nombre: 'Semáforo descompuesto', icono: 'traffic-cone', descripcionCorta: 'Semáforos apagados o en intermitente', slaDiasHabiles: 2, dependencia: 3 },
  { slug: 'parque', nombre: 'Parque en mal estado', icono: 'trees', descripcionCorta: 'Juegos rotos, pasto crecido, bancas dañadas', slaDiasHabiles: 8, dependencia: 4 },
  { slug: 'ruido', nombre: 'Ruido o comercio irregular', icono: 'volume-2', descripcionCorta: 'Ruido excesivo o negocios sin permiso', slaDiasHabiles: 6, dependencia: 3 },
  { slug: 'animal-calle', nombre: 'Animal en situación de calle', icono: 'dog', descripcionCorta: 'Animales abandonados, heridos o agresivos', slaDiasHabiles: 3, dependencia: 4 },
  { slug: 'drenaje', nombre: 'Drenaje tapado', icono: 'waves', descripcionCorta: 'Coladeras tapadas o aguas negras brotando', slaDiasHabiles: 2, dependencia: 2 },
  { slug: 'informacion', nombre: 'Solicitud de información', icono: 'file-question', descripcionCorta: 'Dudas y trámites del municipio', slaDiasHabiles: 5, dependencia: 0, requiereEvidencia: false },
]

/** [PENDIENTE] Nombres genéricos — sustituir por las colonias reales. */
export const COLONIAS = [
  'Centro', 'Nueva Esperanza', 'Lomas del Sur', 'San Isidro', 'Emiliano Zapata',
  'Benito Juárez', 'La Loma', 'Las Palmas', 'Buenavista', 'El Mirador',
  'Ampliación Norte', 'Jardines', 'Independencia', 'Guadalupe', 'Los Pinos',
  'Revolución', 'Santa Cruz', 'El Roble', 'Villa Alegre', 'Solidaridad',
  'Insurgentes', 'La Cañada', 'Vista Hermosa', 'Framboyanes',
]

/**
 * Días festivos oficiales de México (Ley Federal del Trabajo art. 74).
 * Son nacionales, no municipales. Los festivos locales se cargan desde
 * Admin → Días festivos.
 */
export function festivosOficiales(anio: number): { fecha: string; nombre: string }[] {
  const lunesDe = (mes: number, ordinal: number) => {
    const d = new Date(Date.UTC(anio, mes - 1, 1))
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCDate(d.getUTCDate() + 7 * (ordinal - 1))
    return d.toISOString().slice(0, 10)
  }
  return [
    { fecha: `${anio}-01-01`, nombre: 'Año Nuevo' },
    { fecha: lunesDe(2, 1), nombre: 'Día de la Constitución' },
    { fecha: lunesDe(3, 3), nombre: 'Natalicio de Benito Juárez' },
    { fecha: `${anio}-05-01`, nombre: 'Día del Trabajo' },
    { fecha: `${anio}-09-16`, nombre: 'Independencia de México' },
    { fecha: lunesDe(11, 3), nombre: 'Revolución Mexicana' },
    { fecha: `${anio}-12-25`, nombre: 'Navidad' },
  ]
}

/** 8 usuarios, 2 por rol (SPEC §11). Password de demo: ver PENDIENTES.md */
export const USUARIOS = [
  { nombre: 'Ana Ríos',      email: 'admin@municipio.gob.mx',       rol: 'admin' as const,      dependencia: null },
  { nombre: 'Luis Herrera',  email: 'admin2@municipio.gob.mx',      rol: 'admin' as const,      dependencia: null },
  { nombre: 'Carmen Solís',  email: 'operador@municipio.gob.mx',    rol: 'operador' as const,   dependencia: null },
  { nombre: 'Jorge Padilla', email: 'operador2@municipio.gob.mx',   rol: 'operador' as const,   dependencia: null },
  { nombre: 'Rosa Medina',   email: 'supervisor@municipio.gob.mx',  rol: 'supervisor' as const, dependencia: 0 },
  { nombre: 'Iván Cortés',   email: 'supervisor2@municipio.gob.mx', rol: 'supervisor' as const, dependencia: 1 },
  { nombre: 'Pedro Nava',    email: 'cuadrilla@municipio.gob.mx',   rol: 'cuadrilla' as const,  dependencia: 0 },
  { nombre: 'Mario Tovar',   email: 'cuadrilla2@municipio.gob.mx',  rol: 'cuadrilla' as const,  dependencia: 1 },
]

/** Descripciones ciudadanas por categoría, para que la demo se lea real. */
export const DESCRIPCIONES: Record<string, string[]> = {
  bache: ['Hay un bache muy grande a media calle, ya se ponchó una llanta', 'El bache de la esquina crece cada vez que llueve', 'Bache profundo frente a la escuela, pasa mucho niño'],
  luminaria: ['La lámpara de la esquina lleva tres semanas apagada', 'Toda la cuadra quedó a oscuras', 'La luminaria prende y apaga toda la noche'],
  'fuga-agua': ['Sale agua de la banqueta desde ayer, se está desperdiciando mucha', 'Hay una fuga en la toma de la casa, ya se hizo charco', 'Brota agua limpia a media calle'],
  basura: ['Llevan dos semanas sin pasar por la basura', 'Alguien tiró escombro en el terreno baldío', 'Hay basura acumulada en la esquina, ya huele feo'],
  'arbol-riesgo': ['El árbol se venció con el aire y está sobre el cable', 'Rama muy grande a punto de caer sobre la banqueta', 'Árbol seco que puede caer sobre un carro'],
  banqueta: ['La banqueta está levantada y ya se cayó una señora', 'Falta un tramo de banqueta, hay que bajarse a la calle', 'Hoyo en la banqueta frente al negocio'],
  semaforo: ['El semáforo lleva dos días en intermitente', 'Semáforo apagado en el cruce, ya casi hay choques', 'La flecha de vuelta no funciona'],
  parque: ['Los juegos del parque están rotos y oxidados', 'El pasto está muy alto, ya no se puede usar la cancha', 'Se fundieron las luces del parque'],
  ruido: ['Ponen música a todo volumen hasta las 3 de la mañana', 'Abrieron un taller y trabajan de noche', 'Hay un puesto que bloquea toda la banqueta'],
  'animal-calle': ['Hay un perro herido en el camellón', 'Varios perros sin dueño andan en la escuela', 'Un gato lleva días atorado en el techo'],
  drenaje: ['La coladera está tapada y se inunda cuando llueve', 'Salen aguas negras del registro', 'El drenaje huele muy fuerte toda la cuadra'],
  informacion: ['Quiero saber cuándo se paga el predial', 'Necesito el horario de la oficina de licencias', '¿Dónde saco mi constancia de residencia?'],
}
