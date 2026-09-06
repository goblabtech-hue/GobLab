import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { municipio } from '@/lib/config'
import { ESQUEMA_CLASIFICACION, promptClasificador, VERSION_PROMPT } from './prompts/clasificador'
import type { Prioridad } from '@/generated/prisma/enums'

/**
 * Clasificador del bot (SPEC §4.1).
 *
 * Dos reglas de diseño que vienen del spec y no son negociables:
 *
 *  · **Siempre hay respaldo.** Si no hay llave, si la API falla, si el modelo
 *    devuelve algo que no cuadra o si tarda demasiado, el bot cae al menú de
 *    categorías tradicional. Un municipio no puede dejar de recibir reportes
 *    porque un proveedor externo tuvo un mal día.
 *  · **Todo queda auditado.** Cada clasificación se registra con el texto de
 *    entrada, el modelo, la respuesta y si se usó el respaldo. Sin esa
 *    bitácora no hay forma de revisar por qué un reporte acabó en el área
 *    equivocada.
 */

const MODELO = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const TIEMPO_LIMITE_MS = 12_000

/** Debajo de esto no se confía en la categoría: se le pregunta al ciudadano. */
export const CONFIANZA_MINIMA = 0.6

export type Clasificacion = {
  categoriaId: number | null
  prioridad: Prioridad
  esEmergencia: boolean
  coloniaDetectada: string | null
  resumen: string
  confianza: number
  /** true cuando no intervino la IA y hay que mostrar el menú. */
  usoFallback: boolean
}

const RESPALDO: Clasificacion = {
  categoriaId: null,
  prioridad: 'normal',
  esEmergencia: false,
  coloniaDetectada: null,
  resumen: '',
  confianza: 0,
  usoFallback: true,
}

/**
 * Palabras que disparan el escalamiento aunque la IA no esté disponible.
 *
 * Es una red de seguridad deliberadamente burda: el SPEC §4.1 exige que el bot
 * NUNCA intente resolver una emergencia, y esa garantía no puede depender de
 * que la API de un tercero esté arriba.
 */
const PALABRAS_EMERGENCIA = [
  'incendio', 'fuego', 'quemando', 'explosion', 'explosión',
  'accidente', 'atropell', 'herido', 'sangre', 'ambulancia',
  'violencia', 'golpe', 'asalto', 'robo', 'balazo', 'disparo', 'arma',
  'fuga de gas', 'huele a gas', 'gas',
  'cable de alta', 'electrocut', 'descarga eléctrica',
  'se está cayendo', 'atrapado', 'auxilio', 'emergencia', 'urgente ayuda',
]

export function pareceEmergencia(texto: string): boolean {
  const limpio = texto.toLowerCase()
  return PALABRAS_EMERGENCIA.some((p) => limpio.includes(p))
}

let cliente: Anthropic | null = null
function obtenerCliente(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  cliente ??= new Anthropic()
  return cliente
}

export function hayClasificadorIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function clasificar(
  texto: string,
  reporteId?: string,
): Promise<Clasificacion> {
  const inicio = Date.now()
  const anthropic = obtenerCliente()

  // Sin llave no hay nada que intentar: al menú, sin ruido en los registros.
  if (!anthropic) {
    const respaldo = { ...RESPALDO, esEmergencia: pareceEmergencia(texto) }
    await registrar(texto, respaldo, { reporteId, motivo: 'sin ANTHROPIC_API_KEY' })
    return respaldo
  }

  const [categorias, colonias] = await Promise.all([
    prisma.categoria.findMany({
      where: { activa: true }, orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, descripcionCorta: true },
    }),
    prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true } }),
  ])

  try {
    const respuesta = await anthropic.messages.create(
      {
        model: MODELO,
        max_tokens: 512,
        // Clasificar es una tarea corta y acotada: el esfuerzo alto solo
        // costaría más sin mejorar el resultado.
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: ESQUEMA_CLASIFICACION,
          },
        },
        system: promptClasificador({
          municipio: municipio.nombre,
          categorias: categorias.map((c) => ({
            id: c.id, nombre: c.nombre, descripcion: c.descripcionCorta,
          })),
          colonias: colonias.map((c) => c.nombre),
        }),
        messages: [{ role: 'user', content: texto }],
      },
      { timeout: TIEMPO_LIMITE_MS },
    )

    if (respuesta.stop_reason === 'refusal') {
      throw new Error(`el modelo declinó: ${respuesta.stop_details?.category ?? 'sin categoría'}`)
    }

    const bloque = respuesta.content.find((b) => b.type === 'text')
    if (!bloque || bloque.type !== 'text') throw new Error('respuesta sin contenido de texto')

    const crudo = JSON.parse(bloque.text) as {
      categoria_id: number
      prioridad: Prioridad
      es_emergencia: boolean
      colonia_detectada: string | null
      resumen: string
      confianza: number
    }

    // El esquema garantiza la forma, no que el id exista: un id inventado
    // mandaría el reporte a una categoría inexistente.
    const valida = categorias.some((c) => c.id === crudo.categoria_id)

    const clasificacion: Clasificacion = {
      categoriaId: valida ? crudo.categoria_id : null,
      prioridad: crudo.prioridad,
      // La red de palabras clave se suma, nunca se resta: si cualquiera de las
      // dos detecta emergencia, es emergencia.
      esEmergencia: crudo.es_emergencia || pareceEmergencia(texto),
      coloniaDetectada: colonias.some((c) => c.nombre === crudo.colonia_detectada)
        ? crudo.colonia_detectada
        : null,
      resumen: crudo.resumen,
      confianza: valida ? crudo.confianza : 0,
      usoFallback: !valida,
    }

    await registrar(texto, clasificacion, {
      reporteId, respuesta: crudo, latenciaMs: Date.now() - inicio,
      motivo: valida ? undefined : `el modelo devolvió una categoría inexistente (${crudo.categoria_id})`,
    })
    return clasificacion
  } catch (e) {
    const motivo = e instanceof Anthropic.APIError
      ? `${e.constructor.name} ${e.status ?? ''}: ${e.message}`
      : e instanceof Error ? e.message : 'error desconocido'

    const respaldo = { ...RESPALDO, esEmergencia: pareceEmergencia(texto) }
    await registrar(texto, respaldo, { reporteId, motivo, latenciaMs: Date.now() - inicio })
    return respaldo
  }
}

async function registrar(
  texto: string,
  clasificacion: Clasificacion,
  extra: { reporteId?: string; respuesta?: unknown; motivo?: string; latenciaMs?: number },
) {
  try {
    await prisma.clasificacionIA.create({
      data: {
        reporteId: extra.reporteId ?? null,
        textoEntrada: texto.slice(0, 2000),
        modelo: `${MODELO} (prompt ${VERSION_PROMPT})`,
        respuestaJson: (extra.respuesta ?? null) as never,
        categoriaId: clasificacion.categoriaId,
        prioridad: clasificacion.prioridad,
        esEmergencia: clasificacion.esEmergencia,
        usoFallback: clasificacion.usoFallback,
        error: extra.motivo ?? null,
        latenciaMs: extra.latenciaMs ?? null,
      },
    })
  } catch {
    // La auditoría no debe tumbar la conversación del ciudadano.
  }
}
