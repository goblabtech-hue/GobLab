/**
 * Catálogos semilla — Tula de Allende, Hidalgo.
 *
 * Dependencias, correos y colonias salen del portal del propio ayuntamiento
 * (tula.gob.mx: «Dependencias», «Directorio») y del catálogo de asentamientos
 * de Correos de México. Son datos públicos de una institución pública.
 *
 * `responsable` guarda el CARGO y no el nombre de la persona, a propósito. El
 * seed inventa cientos de reportes vencidos, y el informe semanal los muestra
 * junto al responsable del área: publicar «Fulana de Tal — 8 reportes
 * vencidos, 43 días de atraso» sería fabricar una evaluación de desempeño
 * sobre una funcionaria real que no ha hecho nada de eso. Los nombres los
 * captura el municipio en Admin → Dependencias cuando el sistema sea suyo.
 *
 * Las categorías y sus SLA son las 12 que pide el SPEC §11.
 */

export const DEPENDENCIAS = [
  { nombre: 'Dirección de Servicios Municipales', responsable: 'Titular de Servicios Municipales', telefono: '7737320002', correo: 'serviciospublicos@tula.gob.mx' },
  { nombre: 'Dirección de Obras Públicas, Desarrollo Urbano y Catastro', responsable: 'Titular de Obras Públicas', telefono: '7737320002', correo: 'obraspublicas@tula.gob.mx' },
  { nombre: 'CAPyAT · Comisión de Agua Potable y Alcantarillado de Tula', responsable: 'Titular de CAPyAT', telefono: '7737320002', correo: 'capyat@tula.gob.mx' },
  { nombre: 'Secretaría de Seguridad Pública y Tránsito Municipal', responsable: 'Titular de Seguridad Pública y Tránsito', telefono: '7737320002', correo: 'ssptula@tula.gob.mx' },
  { nombre: 'Dirección de Protección Ambiental', responsable: 'Titular de Protección Ambiental', telefono: '7737320002', correo: 'ecologia@tula.gob.mx' },
  // El directorio público no publica correo de esta dirección; se deja vacío
  // en vez de inventarlo. Se completa en Admin → Dependencias.
  { nombre: 'Dirección de Reglamentos y Espectáculos', responsable: 'Titular de Reglamentos y Espectáculos', telefono: '7737320002', correo: null },
  { nombre: 'Dirección de Salud Municipal', responsable: 'Titular de Salud Municipal', telefono: '7737320002', correo: 'salud@tula.gob.mx' },
  { nombre: 'Unidad de Transparencia y Modernización', responsable: 'Titular de la Unidad de Transparencia', telefono: '7737320002', correo: 'transparencia@tula.gob.mx' },
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
  { slug: 'parque', nombre: 'Parque en mal estado', icono: 'trees', descripcionCorta: 'Juegos rotos, pasto crecido, bancas dañadas', slaDiasHabiles: 8, dependencia: 0 },
  { slug: 'ruido', nombre: 'Ruido o comercio irregular', icono: 'volume-2', descripcionCorta: 'Ruido excesivo o negocios sin permiso', slaDiasHabiles: 6, dependencia: 5 },
  { slug: 'animal-calle', nombre: 'Animal en situación de calle', icono: 'dog', descripcionCorta: 'Animales abandonados, heridos o agresivos', slaDiasHabiles: 3, dependencia: 6 },
  { slug: 'drenaje', nombre: 'Drenaje tapado', icono: 'waves', descripcionCorta: 'Coladeras tapadas o aguas negras brotando', slaDiasHabiles: 2, dependencia: 2 },
  { slug: 'informacion', nombre: 'Solicitud de información', icono: 'file-question', descripcionCorta: 'Dudas y trámites del municipio', slaDiasHabiles: 5, dependencia: 7, requiereEvidencia: false },
]

/**
 * Asentamientos de Tula de Allende, del catálogo de Correos de México.
 *
 * El código postal no es un adorno: hay nombres que se repiten en puntos
 * distintos del municipio —«El Cerrito» está en tres— y sin él una cuadrilla
 * puede salir al lugar equivocado. Se incluyen pueblos, barrios,
 * fraccionamientos y rancherías, no solo colonias: el municipio es
 * mayoritariamente eso, y un vecino de San Antonio Tula tiene el mismo derecho
 * a encontrar su localidad en la lista.
 */
export const COLONIAS = [
  { nombre: '16 de Enero', tipo: 'Colonia', cp: '42808' },
  { nombre: 'Acoculco', tipo: 'Colonia', cp: '42845' },
  { nombre: 'Acoculco (Dos Peñas)', tipo: 'Ejido', cp: '42837' },
  { nombre: 'Alborada', tipo: 'Fraccionamiento', cp: '42848' },
  { nombre: 'Alto', tipo: 'Barrio', cp: '42807' },
  { nombre: 'Alvarado', tipo: 'Colonia', cp: '42806' },
  { nombre: 'Antonio Guerrero Briseño', tipo: 'Ranchería', cp: '42827' },
  { nombre: 'Benito Juárez', tipo: 'Colonia', cp: '42827' },
  { nombre: 'Bojay', tipo: 'Ranchería', cp: '42827' },
  { nombre: 'Bomintzha Centro', tipo: 'Colonia', cp: '42832' },
  { nombre: 'Bugambilias', tipo: 'Colonia', cp: '42833' },
  { nombre: 'Bugambilias', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Centro', tipo: 'Colonia', cp: '42800' },
  { nombre: 'Cerrito del Tepeyac', tipo: 'Colonia', cp: '42832' },
  { nombre: 'Chapultepec', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Ciudad Cooperativa Cruz Azul Centro', tipo: 'Colonia', cp: '42840' },
  { nombre: 'Cruz Azul', tipo: 'Colonia', cp: '42846' },
  { nombre: 'De Ferrocarrileros', tipo: 'Fraccionamiento', cp: '42824' },
  { nombre: 'Del Llano', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Dengui', tipo: 'Colonia', cp: '42848' },
  { nombre: 'El Canal', tipo: 'Colonia', cp: '42830' },
  { nombre: 'El Carmen', tipo: 'Colonia', cp: '42830' },
  { nombre: 'El Carmen (La Mesita)', tipo: 'Ranchería', cp: '42835' },
  { nombre: 'El Cerrito', tipo: 'Ranchería', cp: '42835' },
  { nombre: 'El Cerrito', tipo: 'Colonia', cp: '42847' },
  { nombre: 'El Cerrito', tipo: 'Ranchería', cp: '42813' },
  { nombre: 'El Chamizal', tipo: 'Colonia', cp: '42847' },
  { nombre: 'El Cielito', tipo: 'Colonia', cp: '42803' },
  { nombre: 'El Crestón', tipo: 'Colonia', cp: '42814' },
  { nombre: 'El Damu', tipo: 'Fraccionamiento', cp: '42833' },
  { nombre: 'El Gavillero', tipo: 'Ranchería', cp: '42826' },
  { nombre: 'El Godo', tipo: 'Ranchería', cp: '42835' },
  { nombre: 'El Huerto', tipo: 'Colonia', cp: '42807' },
  { nombre: 'El Llano 1a Sección', tipo: 'Colonia', cp: '42803' },
  { nombre: 'El Llano 2a Sección', tipo: 'Colonia', cp: '42803' },
  { nombre: 'El Montecillo', tipo: 'Colonia', cp: '42833' },
  { nombre: 'El Ocote', tipo: 'Ranchería', cp: '42835' },
  { nombre: 'El Paso', tipo: 'Ranchería', cp: '42815' },
  { nombre: 'El Plan', tipo: 'Colonia', cp: '42833' },
  { nombre: 'El Puendhó', tipo: 'Ranchería', cp: '42845' },
  { nombre: 'El Rayo', tipo: 'Colonia', cp: '42834' },
  { nombre: 'El Recinto (Ejido Pueblo Nuevo)', tipo: 'Colonia', cp: '42845' },
  { nombre: 'El Saabi', tipo: 'Colonia', cp: '42836' },
  { nombre: 'El Salitre', tipo: 'Colonia', cp: '42808' },
  { nombre: 'El Salitre', tipo: 'Fraccionamiento', cp: '42808' },
  { nombre: 'El Salto', tipo: 'Colonia', cp: '42834' },
  { nombre: 'El Sesenta y Uno', tipo: 'Colonia', cp: '42836' },
  { nombre: 'El Vindhó', tipo: 'Colonia', cp: '42820' },
  { nombre: 'Empleados Tolteca', tipo: 'Colonia', cp: '42833' },
  { nombre: 'Finca Pedregal', tipo: 'Fraccionamiento', cp: '42842' },
  { nombre: 'FOVISSSTE', tipo: 'Fraccionamiento', cp: '42807' },
  { nombre: 'Galaxia', tipo: 'Fraccionamiento', cp: '42834' },
  { nombre: 'Hacienda de Santa Fe', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Héroes Carranza', tipo: 'Pueblo', cp: '42810' },
  { nombre: 'Ignacio Zaragoza', tipo: 'Pueblo', cp: '42838' },
  { nombre: 'Independencia', tipo: 'Colonia', cp: '42848' },
  { nombre: 'INFONAVIT San Marcos', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Iturbe', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Jalpa', tipo: 'Colonia', cp: '42804' },
  { nombre: 'Julián Villagrán', tipo: 'Colonia', cp: '42827' },
  { nombre: 'La Amistad', tipo: 'Colonia', cp: '42838' },
  { nombre: 'La Cuarta Manzana', tipo: 'Pueblo', cp: '42810' },
  { nombre: 'La Hacienda', tipo: 'Fraccionamiento', cp: '42833' },
  { nombre: 'La Huerta', tipo: 'Colonia', cp: '42803' },
  { nombre: 'La Joya', tipo: 'Colonia', cp: '42830' },
  { nombre: 'La Loma', tipo: 'Colonia', cp: '42843' },
  { nombre: 'La Loma', tipo: 'Fraccionamiento', cp: '42843' },
  { nombre: 'La Magdalena', tipo: 'Exhacienda', cp: '42815' },
  { nombre: 'La Malinche', tipo: 'Colonia', cp: '42809' },
  { nombre: 'La Mezquitera', tipo: 'Colonia', cp: '42835' },
  { nombre: 'La Mezquitera', tipo: 'Colonia', cp: '42816' },
  { nombre: 'La Milpa de García', tipo: 'Ranchería', cp: '42813' },
  { nombre: 'La Pila', tipo: 'Colonia', cp: '42846' },
  { nombre: 'La Romera', tipo: 'Colonia', cp: '42843' },
  { nombre: 'La Vuelta del Río', tipo: 'Colonia', cp: '42833' },
  { nombre: 'Las Cortinas', tipo: 'Ranchería', cp: '42845' },
  { nombre: 'Las Manzanitas', tipo: 'Colonia', cp: '42807' },
  { nombre: 'Las Nueces', tipo: 'Colonia', cp: '42849' },
  { nombre: 'Las Palmas', tipo: 'Fraccionamiento', cp: '42800' },
  { nombre: 'Las Rosas', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Las Violetas', tipo: 'Fraccionamiento', cp: '42834' },
  { nombre: 'Leonardo Rodríguez Alcaine (CFE)', tipo: 'Fraccionamiento', cp: '42833' },
  { nombre: 'Loma Blanca', tipo: 'Fraccionamiento', cp: '42804' },
  { nombre: 'Loma Bonita', tipo: 'Fraccionamiento', cp: '42834' },
  { nombre: 'Lomas de Iturbe', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Los Arcos', tipo: 'Fraccionamiento', cp: '42847' },
  { nombre: 'Los Cedros', tipo: 'Fraccionamiento', cp: '42831' },
  { nombre: 'Los Cipreses', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Los Fresnos', tipo: 'Colonia', cp: '42804' },
  { nombre: 'Los Lagos', tipo: 'Fraccionamiento', cp: '42836' },
  { nombre: 'Los Muelles', tipo: 'Colonia', cp: '42833' },
  { nombre: 'Los Naranjos', tipo: 'Colonia', cp: '42843' },
  { nombre: 'Los Pirules', tipo: 'Fraccionamiento', cp: '42830' },
  { nombre: 'Los Sabinos', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Los Sauces', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'Los Truenitos', tipo: 'Ranchería', cp: '42826' },
  { nombre: 'Mastrantos', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Monte Alegre', tipo: 'Colonia', cp: '42846' },
  { nombre: 'Montecillos', tipo: 'Ranchería', cp: '42838' },
  { nombre: 'Nantzha', tipo: 'Barrio', cp: '42814' },
  { nombre: 'Netzahualcóyotl', tipo: 'Colonia', cp: '42834' },
  { nombre: 'Nueva Santa María', tipo: 'Colonia', cp: '42836' },
  { nombre: 'PEMEX', tipo: 'Unidad habitacional', cp: '42808' },
  { nombre: 'Praderas del Llano', tipo: 'Pueblo', cp: '42826' },
  { nombre: 'Pueblo Nuevo', tipo: 'Colonia', cp: '42845' },
  { nombre: 'Pueblo Nuevo (La Subida)', tipo: 'Ranchería', cp: '42845' },
  { nombre: 'Pueblo Nuevo 2a Sección', tipo: 'Colonia', cp: '42847' },
  { nombre: 'Residencial Arboledas', tipo: 'Fraccionamiento', cp: '42823' },
  { nombre: 'Rinconada de Tultengo', tipo: 'Fraccionamiento', cp: '42803' },
  { nombre: 'San Andrés (San Andrés Tultepec)', tipo: 'Pueblo', cp: '42814' },
  { nombre: 'San Antonio Tula', tipo: 'Pueblo', cp: '42820' },
  { nombre: 'San Carlos', tipo: 'Fraccionamiento', cp: '42824' },
  { nombre: 'San Francisco Bojay', tipo: 'Colonia', cp: '42827' },
  { nombre: 'San Francisco Bojay', tipo: 'Pueblo', cp: '42827' },
  { nombre: 'San José', tipo: 'Colonia', cp: '42805' },
  { nombre: 'San Juan Michimaloya', tipo: 'Pueblo', cp: '42820' },
  { nombre: 'San Lorenzo', tipo: 'Colonia', cp: '42803' },
  { nombre: 'San Lucas Teacalco', tipo: 'Pueblo', cp: '42837' },
  { nombre: 'San Lucas Teacalco', tipo: 'Ejido', cp: '42837' },
  { nombre: 'San Marcos', tipo: 'Colonia', cp: '42831' },
  { nombre: 'San Miguel de las Piedras Primera Sección', tipo: 'Pueblo', cp: '42813' },
  { nombre: 'San Miguel de las Piedras Segunda Sección', tipo: 'Pueblo', cp: '42813' },
  { nombre: 'San Miguel Vindhó', tipo: 'Colonia', cp: '42842' },
  { nombre: 'San Pedrito Alpuyeca', tipo: 'Pueblo', cp: '42830' },
  { nombre: 'San Pedro', tipo: 'Barrio', cp: '42824' },
  { nombre: 'San Pedro', tipo: 'Fraccionamiento', cp: '42824' },
  { nombre: 'Santa Ana Ahuehuepan', tipo: 'Pueblo', cp: '42825' },
  { nombre: 'Santa María Ilucan', tipo: 'Colonia', cp: '42849' },
  { nombre: 'Santa María Macua', tipo: 'Pueblo', cp: '42810' },
  { nombre: 'Santa María Michimaltongo', tipo: 'Colonia', cp: '42813' },
  { nombre: 'Santa María Michimaltongo', tipo: 'Barrio', cp: '42820' },
  { nombre: 'Satélite', tipo: 'Colonia', cp: '42834' },
  { nombre: 'Sesenta y Dos', tipo: 'Colonia', cp: '42836' },
  { nombre: 'Tenjay', tipo: 'Colonia', cp: '42814' },
  { nombre: 'Teocalco', tipo: 'Colonia', cp: '42826' },
  { nombre: 'Tercera Manzana', tipo: 'Colonia', cp: '42832' },
  { nombre: 'Tierra Blanca', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Tollan', tipo: 'Unidad habitacional', cp: '42807' },
  { nombre: 'Tolteca', tipo: 'Colonia', cp: '42830' },
  { nombre: 'Tolteca', tipo: 'Colonia', cp: '42833' },
  { nombre: 'Tolteca', tipo: 'Fraccionamiento', cp: '42833' },
  { nombre: 'Tula (Arriba del Parque Ecológico)', tipo: 'Ejido', cp: '42816' },
  { nombre: 'Tultengo', tipo: 'Colonia', cp: '42803' },
  { nombre: 'Villas del Salitre', tipo: 'Colonia', cp: '42808' },
  { nombre: 'Xijay de Cuauhtémoc', tipo: 'Pueblo', cp: '42813' },
  { nombre: 'Xiteje de la Reforma', tipo: 'Pueblo', cp: '42812' },
  { nombre: 'Xiteje de Zapata', tipo: 'Colonia', cp: '42820' },
  { nombre: 'Xochitlán de las Flores', tipo: 'Pueblo', cp: '42815' },
  { nombre: 'Xonthe', tipo: 'Colonia', cp: '42815' },
] as const

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
