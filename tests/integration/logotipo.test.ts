import 'dotenv/config'
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { guardarLogotipo } from '../../src/infrastructure/almacenamiento/logotipo'
import { storage, ImagenInvalida } from '../../src/infrastructure/almacenamiento'

/**
 * El escudo llega como lo tenga el ayuntamiento: casi siempre un JPEG con
 * fondo blanco y márgenes. Lo que importa es que sobre una cabecera oscura no
 * se vea como un rectángulo blanco.
 */
const bytes = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'escudo-prueba.jpg'))
const archivo = () => new File([new Uint8Array(bytes)], 'escudo.jpg', { type: 'image/jpeg' })
const guardados: string[] = []

const leer = async (url: string) => {
  const ruta = path.join(process.cwd(), 'public', url)
  return sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

after(async () => {
  for (const u of guardados) await storage().borrar(u).catch(() => {})
})

describe('preparar el escudo del municipio', () => {
  test('recorta los márgenes y vuelve transparente el fondo blanco', async () => {
    const { color, blanco } = await guardarLogotipo(archivo())
    guardados.push(color, blanco)
    assert.match(color, /\.png$/)

    const { data, info } = await leer(color)
    // Recortado: el original mide 900×500 con mucho margen; lo guardado no.
    assert.ok(info.width < 900 && info.height <= 240, `${info.width}×${info.height}`)
    // Las esquinas eran fondo blanco: ahora son transparentes.
    const alphaEn = (x: number, y: number) => data[(y * info.width + x) * 4 + 3]!
    assert.equal(alphaEn(0, 0), 0, 'esquina superior izquierda')
    assert.equal(alphaEn(info.width - 1, info.height - 1), 0, 'esquina inferior derecha')
    // Y el escudo sigue ahí: hay píxeles opacos.
    let opacos = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] === 255) opacos++
    assert.ok(opacos > 1000, `píxeles opacos: ${opacos}`)
  })

  test('la versión en blanco tiene la misma silueta, rellena de blanco', async () => {
    const { color, blanco } = await guardarLogotipo(archivo())
    guardados.push(color, blanco)
    const a = await leer(color)
    const b = await leer(blanco)
    assert.equal(a.info.width, b.info.width)
    assert.equal(a.info.height, b.info.height)
    let comparados = 0
    for (let i = 0; i < a.data.length; i += 4) {
      assert.equal(a.data[i + 3], b.data[i + 3], 'misma transparencia píxel a píxel')
      if (b.data[i + 3]! > 0) {
        assert.equal(b.data[i], 255); assert.equal(b.data[i + 1], 255); assert.equal(b.data[i + 2], 255)
        comparados++
      }
    }
    assert.ok(comparados > 1000)
  })

  test('rechaza lo que no es una imagen, con un mensaje claro', async () => {
    const malo = new File([new Uint8Array([1, 2, 3])], 'x.pdf', { type: 'application/pdf' })
    await assert.rejects(() => guardarLogotipo(malo), (e: unknown) => e instanceof ImagenInvalida)
    const vacio = new File([], 'x.png', { type: 'image/png' })
    await assert.rejects(() => guardarLogotipo(vacio), (e: unknown) => e instanceof ImagenInvalida && /vacío/.test(e.message))
  })
})
