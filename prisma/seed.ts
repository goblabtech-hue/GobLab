import 'dotenv/config'
import crypto from 'node:crypto'
import { prisma } from '../src/infrastructure/prisma'
import { obtenerConfiguracion, invalidarConfiguracion, CONFIG_POR_DEFECTO } from '../src/infrastructure/config'
import { calcularFechaLimite } from '../src/domain/dias-habiles'
import { cargarFestivos, invalidarCacheFestivos } from '../src/infrastructure/festivos'
import { derivarTelefono } from '../src/domain/telefono'
import { formatearFolio } from '../src/domain/folio'
import { hashearPassword } from '../src/infrastructure/auth'
import {
  CATEGORIAS, COLONIAS, DEPENDENCIAS, DESCRIPCIONES, USUARIOS, festivosOficiales,
} from './catalogos'
import { generarImagen, prepararDirImagenes } from './imagenes'
import { borradorAviso } from './aviso-privacidad'
import type {
  EstatusReporte, OrigenReporte, Prioridad, TipoEvento, TipoFoto,
} from '../src/generated/prisma/enums'
import type { Prisma } from '../src/generated/prisma/client'

/** PRNG determinista: el mismo seed produce siempre la misma demo. */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260906)

const entre = (a: number, b: number) => a + rnd() * (b - a)
const entero = (a: number, b: number) => Math.floor(entre(a, b + 1))
/** Elige uno al azar. Un catálogo vacío aquí es un error de programación. */
function elegir<T>(xs: readonly T[]): T {
  const x = xs[Math.floor(rnd() * xs.length)]
  if (x === undefined) throw new Error('elegir() recibió una lista vacía.')
  return x
}
const chance = (p: number) => rnd() < p
const id = () => crypto.randomUUID()

/** Elección ponderada: [[valor, peso], ...] */
function ponderado<T>(opciones: [T, number][]): T {
  const ultima = opciones[opciones.length - 1]
  if (!ultima) throw new Error('ponderado() recibió una lista vacía.')
  const total = opciones.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of opciones) { r -= w; if (r <= 0) return v }
  return ultima[0]
}

const DIA = 24 * 60 * 60 * 1000

/**
 * Desenlaces del reporte en la demo. `reabierto_reciente` existe para que el
 * tablero y la vista de cuadrilla tengan reaperturas todavía abiertas que
 * mostrar: las reaperturas viejas se vuelven a resolver, como en la realidad.
 */
type Desenlace =
  | 'a_tiempo' | 'recien_resuelto' | 'reabierto_reciente'
  | 'vencido' | 'abierto' | 'improcedente' | 'duplicado'
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA)

const TELEFONOS_DEMO = Array.from({ length: 120 }, (_, i) =>
  `55${String(10_000_000 + i * 7919).slice(0, 8)}`,
)

async function limpiar() {
  // orden seguro respecto a llaves foráneas
  await prisma.mensajeBot.deleteMany()
  await prisma.conversacionBot.deleteMany()
  await prisma.clasificacionIA.deleteMany()
  await prisma.adhesion.deleteMany()
  await prisma.eventoReporte.deleteMany()
  await prisma.fotoReporte.deleteMany()
  await prisma.$executeRaw`UPDATE "Reporte" SET "reporteOriginalId" = NULL`
  await prisma.reporte.deleteMany()
  await prisma.promesaServicioHistorial.deleteMany()
  await prisma.alertaInterna.deleteMany()
  await prisma.resumenIndicadores.deleteMany()
  await prisma.folioSecuencia.deleteMany()
  await prisma.usuario.deleteMany()
  await prisma.categoria.deleteMany()
  await prisma.colonia.deleteMany()
  await prisma.dependencia.deleteMany()
  await prisma.diaFestivo.deleteMany()
  // La configuración del municipio NO se borra: es trabajo del administrador.
}

async function main() {
  console.log('Limpiando base…')
  await limpiar()

  // La identidad del municipio vive en la base y se edita en /admin/municipio.
  // El seed la siembra desde las variables de entorno solo si no existe: si
  // alguien ya la configuró, resembrar los reportes no debe borrar su trabajo.
  await prisma.configuracionMunicipio.upsert({
    where: { id: 1 },
    create: { id: 1, ...CONFIG_POR_DEFECTO },
    update: {},
  })
  invalidarConfiguracion()
  const municipio = await obtenerConfiguracion()
  console.log(`Municipio: ${municipio.nombre} (folios ${municipio.prefijoFolio}-…)`)

  // Borrador del aviso de privacidad, solo si no existe ninguno: si el
  // municipio ya redactó el suyo, resembrar los reportes no debe pisarlo.
  if ((await prisma.avisoPrivacidad.count()) === 0) {
    await prisma.avisoPrivacidad.create({
      data: {
        version: 1,
        titulo: 'Aviso de privacidad integral',
        contenido: borradorAviso(municipio.nombre, municipio.telEmergencias),
        publicado: true,
        notaCambio: 'Borrador inicial. Pendiente de revisión jurídica.',
        actualizadoPor: 'Sistema',
      },
    })
    console.log('Aviso de privacidad: borrador v1 publicado (pendiente de revisión jurídica)')
  }

  // ---------------------------------------------------------------- catálogos
  console.log('Catálogos…')
  const dependencias = []
  for (const d of DEPENDENCIAS) {
    dependencias.push(await prisma.dependencia.create({ data: { ...d } }))
  }

  /** El índice viene del catálogo semilla: si no existe, el catálogo está mal. */
  const elegirDependencia = <T,>(lista: T[], i: number): T => {
    const d = lista[i]
    if (!d) throw new Error(`El catálogo apunta a la dependencia ${i}, que no existe.`)
    return d
  }

  const categorias = []
  for (const [i, c] of CATEGORIAS.entries()) {
    categorias.push(
      await prisma.categoria.create({
        data: {
          slug: c.slug,
          nombre: c.nombre,
          icono: c.icono,
          descripcionCorta: c.descripcionCorta,
          slaDiasHabiles: c.slaDiasHabiles,
          requiereEvidencia: c.requiereEvidencia ?? true,
          orden: i,
          dependenciaId: elegirDependencia(dependencias, c.dependencia).id,
        },
      }),
    )
  }

  const slugify = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const colonias = []
  for (const nombre of COLONIAS) {
    colonias.push(
      await prisma.colonia.create({
        data: {
          slug: slugify(nombre),
          nombre,
          centroLat: municipio.centroLat + entre(-0.03, 0.03),
          centroLng: municipio.centroLng + entre(-0.03, 0.03),
        },
      }),
    )
  }

  const anio = new Date().getFullYear()
  await prisma.diaFestivo.createMany({
    data: [anio - 1, anio, anio + 1].flatMap((a) =>
      festivosOficiales(a).map((f) => ({ fecha: new Date(`${f.fecha}T00:00:00Z`), nombre: f.nombre })),
    ),
    skipDuplicates: true,
  })
  invalidarCacheFestivos()
  const festivos = await cargarFestivos()

  const passwordDemo = process.env.SEED_PASSWORD ?? 'Demo1234!'
  const hash = await hashearPassword(passwordDemo)
  const usuarios = []
  for (const u of USUARIOS) {
    usuarios.push(
      await prisma.usuario.create({
        data: {
          nombre: u.nombre,
          email: u.email,
          hashPassword: hash,
          rol: u.rol,
          dependenciaId: u.dependencia === null ? null : elegirDependencia(dependencias, u.dependencia).id,
        },
      }),
    )
  }
  const cuadrillas = usuarios.filter((u) => u.rol === 'cuadrilla')
  const operadores = usuarios.filter((u) => u.rol === 'operador')
  const supervisores = usuarios.filter((u) => u.rol === 'supervisor')

  // ---------------------------------------------------------------- reportes
  console.log('Generando imágenes placeholder…')
  await prepararDirImagenes()

  // CORRECCIÓN C-12: el SPEC §11 pide 400 reportes en los últimos 12 meses,
  // pero el §6.8 exige que TODOS los KPIs se comparen "vs. periodo anterior
  // equivalente". Con un solo periodo sembrado esa comparación sale vacía y el
  // tablero no puede demostrar su propia métrica. Se siembran además 12 meses
  // previos, con menos volumen, como si el sistema hubiera ido creciendo.
  const N = 400          // últimos 12 meses (los que pide el SPEC)
  const N_PREVIO = 260   // los 12 meses anteriores, solo para la comparación
  console.log(`Generando ${N + N_PREVIO} reportes…`)
  const PUBLICABLES = 30
  const ahora = new Date()

  const reportes: Prisma.ReporteCreateManyInput[] = []
  const eventos: Prisma.EventoReporteCreateManyInput[] = []
  const fotos: Prisma.FotoReporteCreateManyInput[] = []
  const adhesiones: Prisma.AdhesionCreateManyInput[] = []
  const secuencias = new Map<number, number>()

  // pesos: baches y luminarias dominan el volumen real de un municipio
  const pesosCategoria: [number, number][] = categorias.map((c, i) => {
    const peso = { bache: 18, luminaria: 16, basura: 12, 'fuga-agua': 10, drenaje: 9,
      'arbol-riesgo': 7, banqueta: 7, parque: 6, 'animal-calle': 5, ruido: 4,
      semaforo: 3, informacion: 3 }[c.slug] ?? 5
    return [i, peso]
  })

  // clusters para que la detección de duplicados tenga con qué trabajar
  const clusters = Array.from({ length: 6 }, () => ({
    lat: municipio.centroLat + entre(-0.02, 0.02),
    lng: municipio.centroLng + entre(-0.02, 0.02),
    categoriaIdx: ponderado(pesosCategoria),
  }))

  let publicablesHechos = 0

  for (let i = 0; i < N + N_PREVIO; i++) {
    const esPrevio = i >= N
    const rid = id()
    const enCluster = chance(0.12)
    const cluster = enCluster ? elegir(clusters) : null
    const catIdx = cluster ? cluster.categoriaIdx : ponderado(pesosCategoria)
    const categoria = categorias[catIdx]
    if (!categoria) throw new Error(`El seed eligió una categoría inexistente (${catIdx}).`)
    const colonia = elegir(colonias)

    // ---- desenlace (SPEC §11: 60% a tiempo, 15% vencidos, 8% reasignados, 5% reabiertos)
    // `recien_resuelto` mantiene una bolsa de reportes esperando calificación,
    // que es lo que el criterio de aceptación 3 necesita poder demostrar.
    const desenlace = i >= N
      // El periodo anterior está cerrado: no puede tener reportes todavía
      // abiertos ni recién resueltos, o falsearía la tasa de vencidos de hoy.
      ? ponderado<Desenlace>([
          ['a_tiempo', 68], ['vencido', 20], ['improcedente', 6], ['duplicado', 6],
        ])
      : ponderado<Desenlace>([
          ['a_tiempo', 51], ['recien_resuelto', 6], ['reabierto_reciente', 3],
          ['vencido', 15], ['abierto', 17], ['improcedente', 4], ['duplicado', 4],
        ])

    // Antigüedad del reporte:
    //  · `recien_resuelto` en los últimos días, para que siga dentro de la
    //    ventana de 3 días previa al autocierre;
    //  · los que quedan ABIERTOS se concentran en las últimas semanas. Si se
    //    repartieran por todo el año, casi todos habrían pasado su plazo y la
    //    tasa de vencidos saldría cerca del 100%, que no es un municipio
    //    realista sino uno que dejó de trabajar hace un año. Se deja a
    //    propósito una minoría vieja, que es la que produce los vencidos;
    //  · el resto se distribuye en el periodo con más peso en lo reciente.
    let diasAtras: number
    if (desenlace === 'recien_resuelto') {
      diasAtras = entre(0.5, 2.5)
    } else if (desenlace === 'reabierto_reciente') {
      diasAtras = entre(12, 22)
    } else if (desenlace === 'abierto') {
      // La antigüedad se ata al plazo DE ESTA categoría, no a un número fijo:
      // los plazos van de 2 a 10 días hábiles, así que "hace 18 días" ya está
      // vencido para casi todas. Como N días hábiles siempre abarcan al menos
      // N días naturales, una edad menor al plazo en días naturales garantiza
      // que el reporte esté en tiempo.
      const sla = categoria.slaDiasHabiles
      diasAtras = chance(0.2)
        ? sla * 2 + entre(1, 45)   // el 20% que sí está vencido
        : entre(0, sla * 0.85)     // el resto, en tiempo
    } else {
      diasAtras = Math.floor(Math.pow(rnd(), 0.75) * 364)
    }
    // los del periodo anterior se corren un año hacia atrás
    if (esPrevio) diasAtras += 365
    const createdAt = new Date(ahora.getTime() - diasAtras * DIA - entre(0, DIA))

    const lat = cluster ? cluster.lat + entre(-0.0006, 0.0006) : municipio.centroLat + entre(-0.035, 0.035)
    const lng = cluster ? cluster.lng + entre(-0.0006, 0.0006) : municipio.centroLng + entre(-0.035, 0.035)

    // CORRECCIÓN C-10: el SPEC §11 pide 55/30/15 = 100% y deja `ventanilla`
    // en cero pese a existir en el enum. Se reparte 55/30/10/5.
    const origen = ponderado<OrigenReporte>([
      ['whatsapp', 55], ['web', 30], ['telefono', 10], ['ventanilla', 5],
    ])

    const tieneTel = chance(origen === 'whatsapp' ? 1 : 0.8)
    const telefono = tieneTel ? elegir(TELEFONOS_DEMO) : null
    const tel = telefono ? derivarTelefono(telefono) : null

    const fechaLimite = calcularFechaLimite(createdAt, categoria.slaDiasHabiles, festivos)
    let fechaLimiteFinal = fechaLimite

    const anioR = createdAt.getFullYear()
    const n = (secuencias.get(anioR) ?? 0) + 1
    secuencias.set(anioR, n)
    const folio = formatearFolio(municipio.prefijoFolio, anioR, n)

    const reasignado = chance(0.08)

    let estatus: EstatusReporte = 'nuevo'
    let resueltoAt: Date | null = null
    let cerradoAt: Date | null = null
    let reabiertoAt: Date | null = null
    let calificacion: number | null = null
    let comentario: string | null = null
    let vecesReabierto = 0
    let motivoImprocedente: string | null = null

    const dependenciaId = reasignado
      ? elegir(dependencias.filter((d) => d.id !== categoria.dependenciaId)).id
      : categoria.dependenciaId

    const asignadoAId = elegir(cuadrillas).id

    const eventoBase = (
      tipo: TipoEvento, ts: Date,
      detalle: Prisma.InputJsonValue = {}, userId?: string | null,
    ) => eventos.push({ id: id(), reporteId: rid, tipo, timestamp: ts, detalle, userId: userId ?? null })

    eventoBase('creado', createdAt, { origen })
    const asignadoAt = new Date(createdAt.getTime() + entre(0.02, 0.6) * DIA)

    if (desenlace === 'improcedente') {
      estatus = 'improcedente'
      motivoImprocedente = elegir([
        'La dirección reportada corresponde a una vialidad estatal, no municipal.',
        'El domicilio está fuera de los límites del municipio.',
        'Se trata de un predio particular; no procede intervención municipal.',
      ])
      eventoBase('asignado', asignadoAt, { dependenciaId })
      eventoBase('improcedente', new Date(asignadoAt.getTime() + DIA), { motivo: motivoImprocedente }, elegir(supervisores).id)
    } else if (desenlace === 'duplicado') {
      estatus = 'duplicado'
      eventoBase('duplicado', asignadoAt, {}, elegir(operadores).id)
    } else if (desenlace === 'abierto') {
      estatus = ponderado<EstatusReporte>([['nuevo', 15], ['asignado', 45], ['en_atencion', 40]])
      if (estatus !== 'nuevo') eventoBase('asignado', asignadoAt, { dependenciaId })
      // los reportes abiertos también se reasignan: si no, el KPI de mal ruteo
      // solo mediría reportes ya cerrados y saldría artificialmente bajo
      if (estatus !== 'nuevo' && reasignado) {
        eventoBase('reasignado', new Date(asignadoAt.getTime() + entre(0.2, 2) * DIA), {
          de: categoria.dependenciaId, a: dependenciaId,
          motivo: 'El reporte corresponde a otra dependencia por el tipo de intervención.',
        }, elegir(supervisores).id)
      }
      if (estatus === 'en_atencion') eventoBase('en_atencion', new Date(asignadoAt.getTime() + entre(0.5, 2) * DIA), {}, asignadoAId)
    } else {
      // a_tiempo | vencido
      eventoBase('asignado', asignadoAt, { dependenciaId })
      if (reasignado) {
        eventoBase('reasignado', new Date(asignadoAt.getTime() + entre(0.2, 2) * DIA), {
          de: categoria.dependenciaId, a: dependenciaId,
          motivo: 'El reporte corresponde a otra dependencia por el tipo de intervención.',
        }, elegir(supervisores).id)
      }
      const enAtencionAt = new Date(asignadoAt.getTime() + entre(0.3, 2) * DIA)
      eventoBase('en_atencion', enAtencionAt, {}, asignadoAId)

      const margen = fechaLimite.getTime() - createdAt.getTime()
      resueltoAt = desenlace === 'vencido'
        ? new Date(fechaLimite.getTime() + entre(0.5, 12) * DIA)
        : new Date(createdAt.getTime() + margen * entre(0.25, 0.95))

      if (resueltoAt > ahora) resueltoAt = new Date(ahora.getTime() - entre(0, 2) * DIA)
      if (resueltoAt < enAtencionAt) resueltoAt = new Date(enAtencionAt.getTime() + 0.2 * DIA)

      estatus = 'resuelto'
      eventoBase('resuelto', resueltoAt, {}, asignadoAId)
      eventoBase('notificacion', resueltoAt, { canal: origen === 'whatsapp' ? 'whatsapp' : 'sms', tipo: 'resuelto' })

      const califica = desenlace === 'reabierto_reciente'
        ? true
        : desenlace !== 'recien_resuelto' && tieneTel && chance(0.72)
      if (califica) {
        // sesgo a 4–5 con cola en 1–2 (SPEC §11)
        calificacion = desenlace === 'reabierto_reciente'
          ? ponderado<number>([[2, 60], [1, 40]])
          : ponderado<number>([[5, 46], [4, 27], [3, 12], [2, 9], [1, 6]])
        cerradoAt = new Date(resueltoAt.getTime() + entre(0.1, 2.5) * DIA)
        comentario = calificacion >= 4
          ? elegir(['Quedó muy bien, gracias', 'Rápido y bien hecho', 'Sí lo arreglaron, gracias'])
          : elegir(['Lo taparon a medias, ya se volvió a hundir', 'Tardaron mucho', 'No quedó bien'])
        eventoBase('calificado', cerradoAt, { calificacion }, null)
      } else {
        // autocierre a 3 días sin respuesta (SPEC §4.3)
        cerradoAt = masDias(resueltoAt, 3)
        if (cerradoAt > ahora) cerradoAt = null
      }

      if (cerradoAt) {
        estatus = 'cerrado'
        eventoBase('cerrado', cerradoAt, { automatico: !califica }, null)
      }

      // reaperturas: solo con calificación baja (SPEC §4.2)
      if (cerradoAt && calificacion !== null && calificacion <= 2 &&
          (desenlace === 'reabierto_reciente' || chance(0.55))) {
        reabiertoAt = new Date(cerradoAt.getTime() + entre(0.2, 2) * DIA)
        if (reabiertoAt < ahora) {
          vecesReabierto = 1
          estatus = 'reabierto'
          cerradoAt = null
          // el plazo vuelve a correr desde la reapertura (decisión D-11)
          fechaLimiteFinal = calcularFechaLimite(reabiertoAt, categoria.slaDiasHabiles, festivos)
          eventoBase('reabierto', reabiertoAt, {
            motivo: 'El ciudadano reporta que el problema persiste.',
            nuevaFechaLimite: fechaLimiteFinal.toISOString(),
          }, null)

          // La cuadrilla vuelve y lo resuelve: dejar abiertos para siempre
          // todos los reabiertos del último año haría que la tasa de vencidos
          // midiera reportes que en la realidad ya se atendieron. Solo siguen
          // abiertos los que se reabrieron hace poco.
          const diasDesdeReapertura = (ahora.getTime() - reabiertoAt.getTime()) / DIA
          if (diasDesdeReapertura > 25) {
            resueltoAt = new Date(reabiertoAt.getTime() + entre(0.5, 6) * DIA)
            cerradoAt = new Date(resueltoAt.getTime() + entre(0.2, 3) * DIA)
            estatus = 'cerrado'
            eventoBase('resuelto', resueltoAt, { trasReapertura: true }, asignadoAId)
            eventoBase('cerrado', cerradoAt, { automatico: true })
          }
        } else {
          reabiertoAt = null
        }
      }
    }

    // ---- fotos y galería antes/después
    const esPublicable =
      !esPrevio && estatus === 'cerrado' && resueltoAt !== null &&
      publicablesHechos < PUBLICABLES && chance(0.35)

    if (esPublicable) publicablesHechos++

    reportes.push({
      id: rid, folio, categoriaId: categoria.id, descripcion: elegir(DESCRIPCIONES[categoria.slug] ?? ['Reporte ciudadano']),
      prioridad: ponderado<Prioridad>([['normal', 78], ['alta', 17], ['urgente', 5]]),
      estatus, origen, lat, lng,
      direccionTexto: `Calle ${entero(1, 40)} #${entero(100, 999)}, Col. ${colonia.nombre}`,
      coloniaId: colonia.id,
      telefonoHash: tel?.telefonoHash ?? null,
      telefonoCifrado: tel?.telefonoCifrado ?? null,
      telefonoMascara: tel?.telefonoMascara ?? null,
      nombreContacto: tieneTel && chance(0.6) ? elegir(['María', 'José', 'Laura', 'Miguel', 'Sofía', 'Ricardo']) : null,
      dependenciaId,
      asignadoAId: ['nuevo', 'duplicado', 'improcedente'].includes(estatus) ? null : asignadoAId,
      fechaLimite: fechaLimiteFinal, slaDiasHabilesAplicado: categoria.slaDiasHabiles,
      resueltoAt, cerradoAt, reabiertoAt,
      calificacion, comentarioCalificacion: comentario,
      notaCierre: resueltoAt ? elegir(['Se atendió con cuadrilla y material propio.', 'Trabajo concluido en sitio.', 'Se realizó la reparación completa.']) : null,
      publicable: esPublicable, motivoImprocedente, vecesReabierto,
      createdAt, updatedAt: cerradoAt ?? resueltoAt ?? createdAt,
    })

    // foto del ciudadano
    if (chance(0.45) || esPublicable) {
      fotos.push({
        id: id(), reporteId: rid, tipo: 'ciudadano' as TipoFoto,
        url: esPublicable
          ? await generarImagen(`${folio}-antes`, categoria.nombre, colonia.nombre, 'antes')
          : '/uploads/seed/generico-antes.jpg',
        createdAt,
      })
    }
    // evidencia de resolución (obligatoria si resuelto y la categoría la exige)
    if (resueltoAt && categoria.requiereEvidencia) {
      fotos.push({
        id: id(), reporteId: rid, tipo: 'evidencia' as TipoFoto, subidaPorUserId: asignadoAId,
        url: esPublicable
          ? await generarImagen(`${folio}-despues`, categoria.nombre, colonia.nombre, 'despues')
          : '/uploads/seed/generico-despues.jpg',
        createdAt: resueltoAt,
      })
    }
    if (esPublicable) {
      eventoBase('publicable', masDias(resueltoAt!, 1), { por: 'supervisor' }, elegir(supervisores).id)
    }

    // adhesiones para los clusters
    if (enCluster && ['nuevo', 'asignado', 'en_atencion'].includes(estatus) && chance(0.5)) {
      for (let k = 0; k < entero(1, 5); k++) {
        const t = derivarTelefono(elegir(TELEFONOS_DEMO))
        adhesiones.push({ id: id(), reporteId: rid, ...t, createdAt: new Date(createdAt.getTime() + k * 0.4 * DIA) })
      }
    }
  }

  // imágenes genéricas compartidas por los reportes no publicables
  await generarImagen('generico-antes', 'Reporte ciudadano', 'Imagen de demostración', 'antes')
  await generarImagen('generico-despues', 'Evidencia de resolución', 'Imagen de demostración', 'despues')

  console.log(`Insertando ${reportes.length} reportes…`)
  await prisma.reporte.createMany({ data: reportes })
  await prisma.fotoReporte.createMany({ data: fotos })
  await prisma.eventoReporte.createMany({ data: eventos })
  // dedup de adhesiones: un mismo teléfono no se adhiere dos veces al mismo reporte
  const vistas = new Set<string>()
  const adhesionesUnicas = adhesiones.filter((a) => {
    const k = `${a.reporteId}:${a.telefonoHash}`
    if (vistas.has(k)) return false
    vistas.add(k)
    return true
  })
  await prisma.adhesion.createMany({ data: adhesionesUnicas })

  // liga de duplicados: cada reporte `duplicado` apunta a uno abierto cercano
  const dups = await prisma.reporte.findMany({ where: { estatus: 'duplicado' }, select: { id: true, categoriaId: true, lat: true, lng: true } })
  for (const d of dups) {
    const original = await prisma.reporte.findFirst({
      where: { categoriaId: d.categoriaId, estatus: { in: ['nuevo', 'asignado', 'en_atencion'] }, id: { not: d.id } },
      select: { id: true },
    })
    if (original) await prisma.reporte.update({ where: { id: d.id }, data: { reporteOriginalId: original.id } })
  }

  // la secuencia de folios debe continuar donde quedó el seed
  for (const [a, ultimo] of secuencias) {
    await prisma.folioSecuencia.create({ data: { prefijo: municipio.prefijoFolio, anio: a, ultimo } })
  }

  // ---------------------------------------------------------------- bot
  console.log('Conversaciones del bot…')
  const reportesWa = await prisma.reporte.findMany({
    where: { origen: 'whatsapp' }, select: { id: true, folio: true, createdAt: true, telefonoCifrado: true, telefonoHash: true, telefonoMascara: true, descripcion: true },
  })
  const convs: Prisma.ConversacionBotCreateManyInput[] = []
  const msgs: Prisma.MensajeBotCreateManyInput[] = []
  for (const r of reportesWa) {
    const cid = id()
    convs.push({
      id: cid, canal: 'whatsapp',
      // en WhatsApp el chat id ES el teléfono, así que comparten derivados
      chatIdHash: r.telefonoHash!, chatIdCifrado: r.telefonoCifrado!,
      telefonoHash: r.telefonoHash!, telefonoCifrado: r.telefonoCifrado!, telefonoMascara: r.telefonoMascara!,
      estado: { paso: 'terminado' }, escaladaAHumano: false, reporteId: r.id,
      createdAt: r.createdAt, updatedAt: r.createdAt,
    })
    msgs.push(
      { id: id(), conversacionId: cid, direccion: 'in', texto: 'Hola', timestamp: r.createdAt },
      { id: id(), conversacionId: cid, direccion: 'out', texto: `¡Hola! Soy el asistente de ${municipio.nombre}. ¿Qué necesitas? 1) Nuevo reporte 2) Consultar folio 3) Información 4) Hablar con una persona`, timestamp: new Date(r.createdAt.getTime() + 1000) },
      { id: id(), conversacionId: cid, direccion: 'in', texto: r.descripcion, timestamp: new Date(r.createdAt.getTime() + 30_000) },
      { id: id(), conversacionId: cid, direccion: 'out', texto: `Listo, tu reporte quedó registrado con el folio ${r.folio}.`, timestamp: new Date(r.createdAt.getTime() + 60_000) },
    )
  }
  // conversaciones que no terminaron en reporte (para el embudo del SPEC §4.5)
  for (let i = 0; i < 60; i++) {
    const cid = id()
    const t = derivarTelefono(elegir(TELEFONOS_DEMO))
    const createdAt = new Date(ahora.getTime() - entre(0, 364) * DIA)
    const escalada = chance(0.35)
    convs.push({
      id: cid, canal: 'whatsapp',
      chatIdHash: t.telefonoHash, chatIdCifrado: t.telefonoCifrado,
      ...t,
      estado: { paso: escalada ? 'escalado' : 'menu' },
      escaladaAHumano: escalada, createdAt, updatedAt: createdAt,
    })
    msgs.push(
      { id: id(), conversacionId: cid, direccion: 'in', texto: escalada ? 'Necesito hablar con una persona' : 'Hola', timestamp: createdAt },
      { id: id(), conversacionId: cid, direccion: 'out', texto: escalada ? 'Con gusto. Un momento, te comunico con un operador.' : `¡Hola! Soy el asistente de ${municipio.nombre}.`, timestamp: new Date(createdAt.getTime() + 1000) },
    )
  }
  await prisma.conversacionBot.createMany({ data: convs })
  await prisma.mensajeBot.createMany({ data: msgs })

  // ---------------------------------------------------------------- resumen
  const total = await prisma.reporte.count()
  const porEstatus = await prisma.reporte.groupBy({ by: ['estatus'], _count: true })
  console.log('\n✔ Seed completo')
  console.log(`  Reportes: ${total}`)
  for (const g of porEstatus) console.log(`    ${g.estatus.padEnd(14)} ${g._count}`)
  console.log(`  Publicables (antes/después): ${await prisma.reporte.count({ where: { publicable: true } })}`)
  console.log(`  Adhesiones: ${await prisma.adhesion.count()}`)
  console.log(`  Conversaciones bot: ${await prisma.conversacionBot.count()}`)
  console.log(`\n  Usuarios de demo (contraseña: ${passwordDemo}):`)
  for (const u of USUARIOS) console.log(`    ${u.rol.padEnd(11)} ${u.email}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
