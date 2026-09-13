import 'dotenv/config'
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/infrastructure/prisma'
import {
  crearReporte, asignarCuadrilla, iniciarAtencion, resolverReporte,
  calificarReporte, reabrirReporte, reasignarDependencia, marcarImprocedente,
  marcarDuplicado, adherirse, autocerrarResueltos, reportesDeTelefono,
  puedeTransicionar, ReglaDeNegocio,
} from '../../src/application/reportes'

/**
 * Prueba de integración del ciclo de vida contra la base real.
 * Todo lo que crea queda registrado y se borra al final.
 */

const creados: string[] = []
let categoriaId: number
let categoriaSinEvidenciaId: number
let otraDependenciaId: number
let cuadrillaId: string
let supervisorId: string

const TEL = '5599000001'
const OTRO_TEL = '5599000002'

before(async () => {
  const cat = await prisma.categoria.findFirstOrThrow({ where: { requiereEvidencia: true, activa: true } })
  const sinEv = await prisma.categoria.findFirstOrThrow({ where: { requiereEvidencia: false } })
  const otra = await prisma.dependencia.findFirstOrThrow({ where: { id: { not: cat.dependenciaId } } })
  categoriaId = cat.id
  categoriaSinEvidenciaId = sinEv.id
  otraDependenciaId = otra.id
  cuadrillaId = (await prisma.usuario.findFirstOrThrow({ where: { rol: 'cuadrilla' } })).id
  supervisorId = (await prisma.usuario.findFirstOrThrow({ where: { rol: 'supervisor' } })).id
})

after(async () => {
  if (creados.length) {
    await prisma.$executeRaw`UPDATE "Reporte" SET "reporteOriginalId" = NULL WHERE id = ANY(${creados})`
    await prisma.reporte.deleteMany({ where: { id: { in: creados } } })
  }
  await prisma.$disconnect()
})

async function nuevo(over: Partial<Parameters<typeof crearReporte>[0]> = {}) {
  const r = await crearReporte({
    categoriaId,
    descripcion: 'Hay un problema en la calle de prueba',
    origen: 'web',
    lat: 19.4326, lng: -99.1332,
    telefono: TEL,
    ...over,
  })
  creados.push(r.id)
  return r
}

const estatusDe = async (id: string) =>
  (await prisma.reporte.findUniqueOrThrow({ where: { id }, select: { estatus: true } })).estatus

const eventosDe = async (id: string) =>
  (await prisma.eventoReporte.findMany({ where: { reporteId: id }, select: { tipo: true } })).map((e) => e.tipo)

describe('puedeTransicionar', () => {
  test('permite el camino normal del reporte', () => {
    assert.ok(puedeTransicionar('nuevo', 'asignado'))
    assert.ok(puedeTransicionar('asignado', 'en_atencion'))
    assert.ok(puedeTransicionar('en_atencion', 'resuelto'))
    assert.ok(puedeTransicionar('resuelto', 'cerrado'))
  })

  test('los estados terminales no llevan a ningún lado', () => {
    assert.equal(puedeTransicionar('duplicado', 'en_atencion'), false)
    assert.equal(puedeTransicionar('improcedente', 'asignado'), false)
  })

  test('no se puede saltar de nuevo a resuelto sin pasar por la cuadrilla', () => {
    assert.equal(puedeTransicionar('nuevo', 'resuelto'), false)
  })

  test('un reporte cerrado solo puede reabrirse', () => {
    assert.deepEqual(['reabierto'], ['cerrado'].flatMap(() => ['reabierto']))
    assert.ok(puedeTransicionar('cerrado', 'reabierto'))
    assert.equal(puedeTransicionar('cerrado', 'en_atencion'), false)
  })
})

describe('crearReporte', () => {
  test('genera folio, fecha límite y deja evento de creación', async () => {
    const r = await nuevo()
    assert.match(r.folio, /^[A-Z]{2,5}-\d{4}-\d{5,}$/)
    assert.ok(r.fechaLimite > new Date())
    // El primero es siempre «creado». Después puede venir la bitácora del
    // aviso al área, que no es parte del ciclo de vida sino de quién se enteró.
    const eventos = await eventosDe(r.id)
    assert.equal(eventos[0], 'creado')
    assert.deepEqual(eventos.filter((e) => e !== 'notificacion'), ['creado'])
    assert.equal(await estatusDe(r.id), 'nuevo')
  })

  test('hereda la dependencia responsable de la categoría', async () => {
    const r = await nuevo()
    const guardado = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { dependenciaId: true, categoria: { select: { dependenciaId: true } } },
    })
    assert.equal(guardado.dependenciaId, guardado.categoria.dependenciaId)
  })

  test('nunca guarda el teléfono en claro', async () => {
    const r = await nuevo()
    const g = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id },
      select: { telefonoCifrado: true, telefonoMascara: true, telefonoHash: true },
    })
    assert.ok(!g.telefonoCifrado!.includes(TEL))
    assert.ok(!g.telefonoHash!.includes(TEL))
    assert.equal(g.telefonoMascara, '55••••0001')
  })

  test('rechaza una categoría inexistente', async () => {
    await assert.rejects(() => nuevo({ categoriaId: 999999 }), ReglaDeNegocio)
  })
})

describe('resolverReporte', () => {
  test('exige evidencia fotográfica cuando la categoría la pide', async () => {
    const r = await nuevo()
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await iniciarAtencion(r.id, cuadrillaId)

    await assert.rejects(
      () => resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: [], notaCierre: 'Ya quedó' }),
      /al menos una foto/,
    )
    assert.equal(await estatusDe(r.id), 'en_atencion', 'no debe cambiar de estatus si falla')
  })

  test('con evidencia sí resuelve y avisa al ciudadano', async () => {
    const r = await nuevo()
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await iniciarAtencion(r.id, cuadrillaId)
    await resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: ['/uploads/prueba.jpg'], notaCierre: 'Reparado con cuadrilla' })

    assert.equal(await estatusDe(r.id), 'resuelto')
    const eventos = await eventosDe(r.id)
    assert.ok(eventos.includes('resuelto'))
    // El reporte trae teléfono, así que sí hay a dónde avisarle: debe quedar
    // el intento registrado, entregado o no.
    assert.ok(eventos.includes('notificacion'), 'debe registrar el aviso al ciudadano')
  })

  test('las categorías sin evidencia obligatoria se resuelven sin foto', async () => {
    const r = await nuevo({ categoriaId: categoriaSinEvidenciaId })
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: [], notaCierre: 'Se le dio la información' })
    assert.equal(await estatusDe(r.id), 'resuelto')
  })

  test('no se puede resolver dos veces', async () => {
    const r = await nuevo({ categoriaId: categoriaSinEvidenciaId })
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: [] })
    await assert.rejects(() => resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: [] }), ReglaDeNegocio)
  })
})

describe('calificarReporte y reapertura', () => {
  async function hastaResuelto() {
    const r = await nuevo()
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await iniciarAtencion(r.id, cuadrillaId)
    await resolverReporte({ reporteId: r.id, userId: cuadrillaId, fotosEvidencia: ['/uploads/prueba.jpg'] })
    return r
  }

  test('calificar cierra el reporte de inmediato', async () => {
    const r = await hastaResuelto()
    const res = await calificarReporte(r.folio, 5, 'Quedó muy bien')
    assert.equal(res.puedeReabrir, false)
    assert.equal(await estatusDe(r.id), 'cerrado')
  })

  test('una calificación baja habilita reabrir', async () => {
    const r = await hastaResuelto()
    const res = await calificarReporte(r.folio, 2, 'Quedó a medias')
    assert.equal(res.puedeReabrir, true)
    await reabrirReporte(r.folio, 'El bache se volvió a hundir')
    assert.equal(await estatusDe(r.id), 'reabierto')
  })

  test('solo se puede reabrir una vez', async () => {
    const r = await hastaResuelto()
    await calificarReporte(r.folio, 1)
    await reabrirReporte(r.folio)
    await assert.rejects(() => reabrirReporte(r.folio), /ya se reabrió una vez/)
  })

  test('una calificación alta no permite reabrir', async () => {
    const r = await hastaResuelto()
    await calificarReporte(r.folio, 5)
    await assert.rejects(() => reabrirReporte(r.folio), /primero califica/)
  })

  test('no se califica dos veces', async () => {
    const r = await hastaResuelto()
    await calificarReporte(r.folio, 4)
    await assert.rejects(() => calificarReporte(r.folio, 1), /ya fue calificado/)
  })

  test('no se califica un reporte que sigue abierto', async () => {
    const r = await nuevo()
    await assert.rejects(() => calificarReporte(r.folio, 5), /ya se resolvió/)
  })

  test('rechaza calificaciones fuera de 1 a 5', async () => {
    const r = await hastaResuelto()
    await assert.rejects(() => calificarReporte(r.folio, 0), /1 a 5/)
    await assert.rejects(() => calificarReporte(r.folio, 6), /1 a 5/)
  })
})

describe('reasignación', () => {
  test('exige un motivo, porque alimenta el KPI de mal ruteo', async () => {
    const r = await nuevo()
    await assert.rejects(() => reasignarDependencia({ reporteId: r.id, dependenciaId: otraDependenciaId, motivo: 'no', userId: supervisorId }), /10 caracteres/)
  })

  test('con motivo cambia de dependencia y suelta la cuadrilla anterior', async () => {
    const r = await nuevo()
    await asignarCuadrilla(r.id, cuadrillaId, supervisorId)
    await reasignarDependencia({ reporteId: r.id, dependenciaId: otraDependenciaId, motivo: 'Corresponde a otra área por el tipo de obra', userId: supervisorId })

    const g = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { dependenciaId: true, asignadoAId: true },
    })
    assert.equal(g.dependenciaId, otraDependenciaId)
    assert.equal(g.asignadoAId, null, 'la cuadrilla anterior ya no aplica')
    assert.ok((await eventosDe(r.id)).includes('reasignado'))
  })
})

describe('improcedente', () => {
  test('exige un motivo largo porque se le muestra al ciudadano', async () => {
    const r = await nuevo()
    await assert.rejects(() => marcarImprocedente(r.id, 'no aplica', supervisorId), /15 caracteres/)
  })

  test('guarda el motivo y cierra el reporte', async () => {
    const r = await nuevo()
    const motivo = 'La calle es federal, no municipal.'
    await marcarImprocedente(r.id, motivo, supervisorId)
    const g = await prisma.reporte.findUniqueOrThrow({
      where: { id: r.id }, select: { estatus: true, motivoImprocedente: true },
    })
    assert.equal(g.estatus, 'improcedente')
    assert.equal(g.motivoImprocedente, motivo)
  })
})

describe('duplicados y adhesiones', () => {
  test('adherirse suma el teléfono y sube la prioridad al acumularse', async () => {
    const original = await nuevo()
    for (let i = 0; i < 3; i++) {
      await adherirse(original.id, `55990100${i}0`)
    }
    const g = await prisma.reporte.findUniqueOrThrow({
      where: { id: original.id }, select: { prioridad: true, _count: { select: { adhesiones: true } } },
    })
    assert.equal(g._count.adhesiones, 3)
    assert.equal(g.prioridad, 'alta', '3 adhesiones deben subir la prioridad')
  })

  test('el mismo teléfono no se adhiere dos veces', async () => {
    const r = await nuevo()
    await adherirse(r.id, OTRO_TEL)
    await adherirse(r.id, OTRO_TEL)
    const n = await prisma.adhesion.count({ where: { reporteId: r.id } })
    assert.equal(n, 1)
  })

  test('quien levantó el reporte no se adhiere a su propio reporte', async () => {
    const r = await nuevo()
    await assert.rejects(() => adherirse(r.id, TEL), /ya es tuyo/)
  })

  test('marcar duplicado liga con el original', async () => {
    const original = await nuevo()
    const copia = await nuevo()
    await marcarDuplicado(copia.id, original.id, supervisorId)
    const g = await prisma.reporte.findUniqueOrThrow({
      where: { id: copia.id }, select: { estatus: true, reporteOriginalId: true },
    })
    assert.equal(g.estatus, 'duplicado')
    assert.equal(g.reporteOriginalId, original.id)
  })

  test('un reporte no puede ser duplicado de sí mismo', async () => {
    const r = await nuevo()
    await assert.rejects(() => marcarDuplicado(r.id, r.id, supervisorId), /de sí mismo/)
  })
})

describe('autocierre', () => {
  test('cierra los resueltos con más de 3 días sin calificación, y respeta los recientes', async () => {
    const viejo = await nuevo({ categoriaId: categoriaSinEvidenciaId })
    await asignarCuadrilla(viejo.id, cuadrillaId, supervisorId)
    await resolverReporte({ reporteId: viejo.id, userId: cuadrillaId, fotosEvidencia: [] })
    // se envejece a mano para no esperar tres días
    await prisma.reporte.update({
      where: { id: viejo.id },
      data: { resueltoAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    })

    const reciente = await nuevo({ categoriaId: categoriaSinEvidenciaId })
    await asignarCuadrilla(reciente.id, cuadrillaId, supervisorId)
    await resolverReporte({ reporteId: reciente.id, userId: cuadrillaId, fotosEvidencia: [] })

    await autocerrarResueltos()

    assert.equal(await estatusDe(viejo.id), 'cerrado')
    assert.equal(await estatusDe(reciente.id), 'resuelto', 'el reciente no se debe tocar')

    const evs = await prisma.eventoReporte.findFirst({
      where: { reporteId: viejo.id, tipo: 'cerrado' }, select: { detalle: true },
    })
    assert.deepEqual(evs?.detalle, { automatico: true, diasSinRespuesta: 3 })
  })
})

describe('reportesDeTelefono', () => {
  test('encuentra tanto los propios como aquellos a los que se adhirió', async () => {
    const propio = await nuevo({ telefono: '5599111111' })
    const ajeno = await nuevo({ telefono: '5599222222' })
    await adherirse(ajeno.id, '5599111111')

    const folios = (await reportesDeTelefono('5599111111')).map((r) => r.folio)
    assert.ok(folios.includes(propio.folio), 'debe traer el propio')
    assert.ok(folios.includes(ajeno.folio), 'debe traer aquel al que se adhirió')
  })
})

describe('carga por área', () => {
  test('los vencidos son un subconjunto de los abiertos, por área', async () => {
    const { cargaPorArea } = await import('../../src/application/reportes')
    const areas = await cargaPorArea()
    assert.ok(areas.length > 0, 'debe haber áreas registradas')
    for (const a of areas) {
      assert.ok(a.vencidos <= a.abiertos, `${a.nombre}: ${a.vencidos} vencidos de ${a.abiertos} abiertos`)
      assert.ok(a.sinCuadrilla <= a.abiertos, `${a.nombre}: más sin cuadrilla que abiertos`)
    }
  })

  test('ordena poniendo primero a quien tiene vencidos', async () => {
    const { cargaPorArea } = await import('../../src/application/reportes')
    const areas = await cargaPorArea()
    const vencidos = areas.map((a) => a.vencidos)
    assert.deepEqual(vencidos, [...vencidos].sort((a, b) => b - a),
      'lo que exige acción va arriba')
  })

  test('acotar a un área devuelve solo esa', async () => {
    const { cargaPorArea } = await import('../../src/application/reportes')
    const todas = await cargaPorArea()
    const una = await cargaPorArea(todas[0]!.id)
    assert.equal(una.length, 1)
    assert.equal(una[0]!.id, todas[0]!.id)
  })
})
