import { prisma } from '@/infrastructure/prisma'
import { diasHabilesEntre, claveDeFecha } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'

/**
 * Dataset público de reportes (SPEC §4.4g).
 *
 * CORRECCIÓN C-13: el SPEC pide un dataset "anonimizado (sin teléfonos ni
 * nombres)". Quitar esas dos columnas no basta:
 *
 *  · La **descripción** la escribe el ciudadano en texto libre y es normal que
 *    contenga nombres, direcciones o señas de vecinos ("el de la casa azul
 *    pone música"). Publicarla en bruto filtra datos personales aunque las
 *    columnas de contacto no estén. Queda fuera del dataset; sigue visible en
 *    la página del folio, que es de quien reportó.
 *  · La **dirección exacta** tiene el mismo problema y también queda fuera.
 *  · Las **coordenadas** se redondean a cuatro decimales (~11 m). Basta para
 *    mapear un bache y evita señalar una vivienda concreta en quejas que son
 *    entre vecinos, como ruido o un animal en la calle.
 *
 * Se publica la colonia, que es la unidad geográfica con la que la gente
 * razona y no identifica a nadie.
 */

export const DICCIONARIO = [
  { campo: 'folio', tipo: 'texto', descripcion: 'Identificador único del reporte.' },
  { campo: 'categoria', tipo: 'texto', descripcion: 'Tipo de problema reportado.' },
  { campo: 'colonia', tipo: 'texto', descripcion: 'Colonia donde se ubica el reporte. Vacío si no se registró.' },
  { campo: 'dependencia', tipo: 'texto', descripcion: 'Área municipal responsable de atenderlo.' },
  { campo: 'estatus', tipo: 'texto', descripcion: 'Estado actual: nuevo, asignado, en_atencion, resuelto, cerrado, reabierto, duplicado o improcedente.' },
  { campo: 'prioridad', tipo: 'texto', descripcion: 'normal, alta o urgente.' },
  { campo: 'origen', tipo: 'texto', descripcion: 'Canal por el que llegó: whatsapp, web, telefono o ventanilla.' },
  { campo: 'lat', tipo: 'decimal', descripcion: 'Latitud, redondeada a 4 decimales (~11 m).' },
  { campo: 'lng', tipo: 'decimal', descripcion: 'Longitud, redondeada a 4 decimales (~11 m).' },
  { campo: 'fecha_creacion', tipo: 'fecha', descripcion: 'Día en que se recibió el reporte (AAAA-MM-DD).' },
  { campo: 'fecha_limite', tipo: 'fecha', descripcion: 'Día en que vence la promesa de servicio.' },
  { campo: 'fecha_resolucion', tipo: 'fecha', descripcion: 'Día en que se marcó como resuelto. Vacío si sigue abierto.' },
  { campo: 'fecha_cierre', tipo: 'fecha', descripcion: 'Día en que se cerró. Vacío si sigue abierto.' },
  { campo: 'sla_dias_habiles', tipo: 'entero', descripcion: 'Plazo comprometido para esta categoría.' },
  { campo: 'dias_habiles_resolucion', tipo: 'entero', descripcion: 'Días hábiles que tomó resolverlo. Vacío si sigue abierto.' },
  { campo: 'resuelto_a_tiempo', tipo: 'booleano', descripcion: 'true si se resolvió en o antes de la fecha límite.' },
  { campo: 'veces_reabierto', tipo: 'entero', descripcion: 'Cuántas veces el ciudadano pidió reabrirlo.' },
  { campo: 'calificacion', tipo: 'entero', descripcion: 'Estrellas de 1 a 5 que dio el ciudadano. Vacío si no calificó.' },
  { campo: 'adhesiones', tipo: 'entero', descripcion: 'Cuántos vecinos se sumaron al mismo reporte.' },
  { campo: 'reasignado', tipo: 'booleano', descripcion: 'true si tuvo que pasar de un área a otra.' },
] as const

export type FilaAbierta = Record<string, string | number | boolean | null>

const redondear = (n: number | null) => (n === null ? null : Math.round(n * 10_000) / 10_000)
const soloFecha = (d: Date | null) => (d === null ? null : claveDeFecha(d))

export async function generarDataset(): Promise<FilaAbierta[]> {
  const [reportes, festivos, reasignados] = await Promise.all([
    prisma.reporte.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, folio: true, estatus: true, prioridad: true, origen: true,
        lat: true, lng: true, createdAt: true, fechaLimite: true,
        resueltoAt: true, cerradoAt: true, calificacion: true, vecesReabierto: true,
        categoria: { select: { nombre: true, slaDiasHabiles: true } },
        colonia: { select: { nombre: true } },
        dependencia: { select: { nombre: true } },
        _count: { select: { adhesiones: true } },
      },
    }),
    cargarFestivos(),
    prisma.eventoReporte.findMany({
      where: { tipo: 'reasignado' }, select: { reporteId: true }, distinct: ['reporteId'],
    }),
  ])

  const fueReasignado = new Set(reasignados.map((r) => r.reporteId))

  return reportes.map((r) => ({
    folio: r.folio,
    categoria: r.categoria.nombre,
    colonia: r.colonia?.nombre ?? null,
    dependencia: r.dependencia.nombre,
    estatus: r.estatus,
    prioridad: r.prioridad,
    origen: r.origen,
    lat: redondear(r.lat),
    lng: redondear(r.lng),
    fecha_creacion: soloFecha(r.createdAt),
    fecha_limite: soloFecha(r.fechaLimite),
    fecha_resolucion: soloFecha(r.resueltoAt),
    fecha_cierre: soloFecha(r.cerradoAt),
    sla_dias_habiles: r.categoria.slaDiasHabiles,
    dias_habiles_resolucion: r.resueltoAt
      ? diasHabilesEntre(r.createdAt, r.resueltoAt, festivos)
      : null,
    resuelto_a_tiempo: r.resueltoAt ? r.resueltoAt <= r.fechaLimite : null,
    veces_reabierto: r.vecesReabierto,
    calificacion: r.calificacion,
    adhesiones: r._count.adhesiones,
    reasignado: fueReasignado.has(r.id),
  }))
}
