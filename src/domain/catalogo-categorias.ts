/**
 * Catálogo maestro de problemas que atiende un municipio.
 *
 * Es el menú completo del que cada municipio activa lo que le aplica, desde
 * /admin/categorías. Sale de los servicios que el artículo 115 constitucional
 * le encarga al municipio —agua, drenaje, alumbrado, limpia, mercados,
 * panteones, calles, parques, tránsito, protección civil— y de lo que la
 * gente de verdad reporta.
 *
 * Solo problemas de servicios públicos y espacio urbano: cosas que una
 * cuadrilla va y arregla. Los casos personales (violencia, adicciones,
 * personas en situación de calle) se atienden por otras vías y NO van aquí:
 * un reporte así en un mapa público, con coordenada, es un daño.
 *
 * `area` sirve para proponer la dependencia al activar; el administrador la
 * puede cambiar después. `sla` es una sugerencia de arranque en días hábiles.
 */

export type AreaCategoria =
  | 'servicios'    // alumbrado, limpia, parques, panteones, mercados
  | 'obras'        // calles, banquetas, obra pública
  | 'agua'         // agua potable, drenaje, alcantarillado
  | 'transito'     // semáforos, señalización, vialidad
  | 'ambiente'     // árboles, contaminación, fauna
  | 'reglamentos'  // comercio, ruido, construcciones
  | 'proteccion'   // riesgos: cables, postes, deslaves
  | 'transparencia'

export const AREAS: Record<AreaCategoria, { nombre: string; palabras: string[] }> = {
  servicios:    { nombre: 'Servicios municipales',      palabras: ['servicios'] },
  obras:        { nombre: 'Obras públicas y vialidades', palabras: ['obras'] },
  agua:         { nombre: 'Agua y drenaje',              palabras: ['agua', 'capyat', 'alcantarillado'] },
  transito:     { nombre: 'Tránsito y movilidad',        palabras: ['transito', 'tránsito', 'movilidad', 'seguridad'] },
  ambiente:     { nombre: 'Medio ambiente',              palabras: ['ambient', 'ecolog'] },
  reglamentos:  { nombre: 'Reglamentos y comercio',      palabras: ['reglamento', 'comercio'] },
  proteccion:   { nombre: 'Protección civil',            palabras: ['proteccion civil', 'protección civil'] },
  transparencia:{ nombre: 'Atención e información',      palabras: ['transparencia', 'atencion ciudadana', 'atención ciudadana'] },
}

export type CategoriaMaestra = {
  slug: string
  nombre: string
  descripcion: string
  icono: string
  area: AreaCategoria
  sla: number
  /** Si la cuadrilla debe subir foto del trabajo terminado. */
  evidencia?: boolean
}

export const CATALOGO_CATEGORIAS: CategoriaMaestra[] = [
  // ── Servicios municipales ──────────────────────────────────────────────
  { slug: 'luminaria', nombre: 'Luminaria apagada', descripcion: 'Lámparas del alumbrado público que no encienden', icono: 'lightbulb-off', area: 'servicios', sla: 3 },
  { slug: 'luminaria-dia', nombre: 'Luminaria encendida de día', descripcion: 'Alumbrado prendido a plena luz, desperdicio de energía', icono: 'sun', area: 'servicios', sla: 5 },
  { slug: 'basura', nombre: 'Basura acumulada', descripcion: 'Montones de basura en vía pública', icono: 'trash-2', area: 'servicios', sla: 2 },
  { slug: 'camion-basura', nombre: 'No pasa el camión de la basura', descripcion: 'La recolección no ha pasado en su día', icono: 'truck', area: 'servicios', sla: 2 },
  { slug: 'tiradero', nombre: 'Tiradero clandestino', descripcion: 'Escombro o basura que alguien deja en un lote o terreno', icono: 'biohazard', area: 'servicios', sla: 5 },
  { slug: 'parque', nombre: 'Parque en mal estado', descripcion: 'Juegos rotos, pasto crecido, bancas dañadas', icono: 'trees', area: 'servicios', sla: 8 },
  { slug: 'maleza', nombre: 'Maleza en vía pública', descripcion: 'Hierba crecida en camellones, banquetas o lotes baldíos', icono: 'sprout', area: 'servicios', sla: 7 },
  { slug: 'panteon', nombre: 'Panteón en mal estado', descripcion: 'Limpieza, bardas, pasillos o servicios del panteón', icono: 'church', area: 'servicios', sla: 10 },
  { slug: 'mercado', nombre: 'Mercado municipal', descripcion: 'Limpieza, techos, drenaje o instalaciones del mercado', icono: 'store', area: 'servicios', sla: 7 },
  { slug: 'grafiti', nombre: 'Grafiti o vandalismo en bienes públicos', descripcion: 'Pintas en muros, paradas, monumentos o mobiliario municipal', icono: 'spray-can', area: 'servicios', sla: 10 },
  { slug: 'parada-autobus', nombre: 'Parada de autobús dañada', descripcion: 'Paradero roto, sin techo o sin banca', icono: 'bus', area: 'servicios', sla: 10 },

  // ── Obras públicas y vialidades ────────────────────────────────────────
  { slug: 'bache', nombre: 'Bache en la calle', descripcion: 'Hoyos o hundimientos en el pavimento', icono: 'construction', area: 'obras', sla: 5 },
  { slug: 'banqueta', nombre: 'Banqueta dañada', descripcion: 'Banquetas rotas, levantadas o con hoyos', icono: 'footprints', area: 'obras', sla: 10 },
  { slug: 'coladera-sin-tapa', nombre: 'Coladera o registro sin tapa', descripcion: 'Alcantarilla abierta en calle o banqueta: riesgo de caída', icono: 'circle-dashed', area: 'obras', sla: 1 },
  { slug: 'calle-sin-pavimentar', nombre: 'Calle sin pavimentar o en mal estado', descripcion: 'Terracería intransitable, empedrado deshecho', icono: 'route', area: 'obras', sla: 15 },
  { slug: 'encharcamiento', nombre: 'Encharcamiento o inundación', descripcion: 'Agua estancada en la calle cada que llueve', icono: 'cloud-rain', area: 'obras', sla: 5 },
  { slug: 'rampa', nombre: 'Falta rampa de accesibilidad', descripcion: 'Esquina sin rampa para silla de ruedas o carriola', icono: 'accessibility', area: 'obras', sla: 20 },
  { slug: 'puente-peatonal', nombre: 'Puente peatonal dañado', descripcion: 'Escalones, barandal o piso en mal estado', icono: 'bridge', area: 'obras', sla: 10 },

  // ── Agua y drenaje ─────────────────────────────────────────────────────
  { slug: 'fuga-agua', nombre: 'Fuga de agua', descripcion: 'Agua saliendo de tuberías, tomas o la calle', icono: 'droplets', area: 'agua', sla: 2 },
  { slug: 'sin-agua', nombre: 'No llega el agua', descripcion: 'Días sin servicio o con muy poca presión', icono: 'droplet-off', area: 'agua', sla: 3, evidencia: false },
  { slug: 'agua-sucia', nombre: 'Agua sucia o con mal olor', descripcion: 'El agua de la llave sale turbia, con color o con olor', icono: 'flask-conical', area: 'agua', sla: 2, evidencia: false },
  { slug: 'drenaje', nombre: 'Drenaje tapado', descripcion: 'Coladeras tapadas o aguas negras brotando', icono: 'waves', area: 'agua', sla: 2 },
  { slug: 'fuga-drenaje', nombre: 'Fuga de aguas negras', descripcion: 'Aguas residuales corriendo por la calle', icono: 'alert-triangle', area: 'agua', sla: 1 },
  { slug: 'pipa', nombre: 'Solicitud de pipa de agua', descripcion: 'Pedir abasto por pipa mientras no hay servicio', icono: 'container', area: 'agua', sla: 2, evidencia: false },

  // ── Tránsito y movilidad ───────────────────────────────────────────────
  { slug: 'semaforo', nombre: 'Semáforo descompuesto', descripcion: 'Semáforos apagados o en intermitente', icono: 'traffic-cone', area: 'transito', sla: 2 },
  { slug: 'senalamiento', nombre: 'Señalamiento vial dañado o faltante', descripcion: 'Señales caídas, borradas o que hacen falta', icono: 'octagon-alert', area: 'transito', sla: 7 },
  { slug: 'tope', nombre: 'Solicitud o retiro de tope', descripcion: 'Pedir un reductor de velocidad, o quitar uno mal puesto', icono: 'gauge', area: 'transito', sla: 20, evidencia: false },
  { slug: 'pintura-vial', nombre: 'Pintura de calle borrada', descripcion: 'Rayas peatonales, carriles o topes sin pintura', icono: 'paintbrush', area: 'transito', sla: 10 },
  { slug: 'vehiculo-abandonado', nombre: 'Vehículo abandonado', descripcion: 'Auto que lleva semanas sin moverse en la vía pública', icono: 'car', area: 'transito', sla: 10 },
  { slug: 'invasion-via', nombre: 'Invasión de la vía pública', descripcion: 'Puestos, materiales o vehículos que bloquean banqueta o calle', icono: 'ban', area: 'transito', sla: 5 },

  // ── Medio ambiente ─────────────────────────────────────────────────────
  { slug: 'arbol-riesgo', nombre: 'Árbol caído o en riesgo', descripcion: 'Ramas o árboles que pueden caer', icono: 'tree-deciduous', area: 'ambiente', sla: 4 },
  { slug: 'poda', nombre: 'Solicitud de poda', descripcion: 'Ramas que tapan luminarias, cables o señales', icono: 'scissors', area: 'ambiente', sla: 10 },
  { slug: 'animal-calle', nombre: 'Animal en situación de calle', descripcion: 'Animales abandonados, heridos o agresivos', icono: 'dog', area: 'ambiente', sla: 3 },
  { slug: 'plaga', nombre: 'Plaga o fauna nociva', descripcion: 'Ratas, mosquitos, enjambres en espacio público', icono: 'bug', area: 'ambiente', sla: 5 },
  { slug: 'quema', nombre: 'Quema de basura o humo', descripcion: 'Alguien quema desechos y el humo afecta a los vecinos', icono: 'flame', area: 'ambiente', sla: 3, evidencia: false },
  { slug: 'contaminacion-agua', nombre: 'Contaminación de río o canal', descripcion: 'Descargas, basura o mortandad de peces en un cuerpo de agua', icono: 'fish', area: 'ambiente', sla: 5 },

  // ── Reglamentos y comercio ─────────────────────────────────────────────
  { slug: 'ruido', nombre: 'Ruido o comercio irregular', descripcion: 'Ruido excesivo o negocios sin permiso', icono: 'volume-2', area: 'reglamentos', sla: 6, evidencia: false },
  { slug: 'construccion-irregular', nombre: 'Construcción sin permiso', descripcion: 'Obra que invade, no tiene licencia o pone en riesgo', icono: 'hard-hat', area: 'reglamentos', sla: 10, evidencia: false },
  { slug: 'anuncio-irregular', nombre: 'Anuncio o espectacular irregular', descripcion: 'Publicidad sin permiso o en riesgo de caer', icono: 'megaphone', area: 'reglamentos', sla: 10 },

  // ── Protección civil ───────────────────────────────────────────────────
  { slug: 'poste-riesgo', nombre: 'Poste caído o a punto de caer', descripcion: 'Poste de luz o teléfono inclinado, chocado o roto', icono: 'utility-pole', area: 'proteccion', sla: 1 },
  { slug: 'cables', nombre: 'Cables colgando o caídos', descripcion: 'Cableado suelto al alcance de la gente', icono: 'cable', area: 'proteccion', sla: 1 },
  { slug: 'barda-riesgo', nombre: 'Barda o construcción en riesgo de caer', descripcion: 'Muros inclinados, techos sueltos, estructuras inestables', icono: 'brick-wall', area: 'proteccion', sla: 2 },
  { slug: 'deslave', nombre: 'Deslave o hundimiento', descripcion: 'Tierra o piedras que se vienen abajo, socavones', icono: 'mountain', area: 'proteccion', sla: 1 },

  // ── Atención e información ─────────────────────────────────────────────
  { slug: 'informacion', nombre: 'Solicitud de información', descripcion: 'Dudas y trámites del municipio', icono: 'file-question', area: 'transparencia', sla: 5, evidencia: false },
]

export function categoriaMaestra(slug: string): CategoriaMaestra | undefined {
  return CATALOGO_CATEGORIAS.find((c) => c.slug === slug)
}

/** Agrupadas por área, en el orden de AREAS. */
export function catalogoPorArea(): { area: AreaCategoria; nombre: string; categorias: CategoriaMaestra[] }[] {
  return (Object.keys(AREAS) as AreaCategoria[]).map((area) => ({
    area, nombre: AREAS[area].nombre,
    categorias: CATALOGO_CATEGORIAS.filter((c) => c.area === area),
  }))
}
