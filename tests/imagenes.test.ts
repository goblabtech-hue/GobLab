import 'dotenv/config'
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { guardarImagen, ImagenInvalida, LIMITE_BYTES } from '../src/lib/storage'

/**
 * El re-encode del SPEC §7 no es cosmético: las fotos del ciudadano terminan
 * publicadas en la galería antes/después, y una foto de celular trae la
 * ubicación GPS exacta de quien la tomó en sus metadatos EXIF.
 */

const creados: string[] = []

after(async () => {
  for (const url of creados) {
    await fs.rm(path.join(process.cwd(), 'public', url), { force: true })
  }
})

async function guardarYLeer(archivo: File) {
  const url = await guardarImagen(archivo)
  creados.push(url)
  return {
    url,
    buffer: await fs.readFile(path.join(process.cwd(), 'public', url)),
  }
}

function comoFile(buffer: Buffer, nombre: string, tipo: string) {
  return new File([new Uint8Array(buffer)], nombre, { type: tipo })
}

/** JPEG con EXIF, incluida ubicación GPS, como el de cualquier celular. */
async function jpegConGps() {
  return sharp({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .withExif({
      IFD0: { Make: 'ACME', Model: 'Telefono X', Software: 'Camara 1.0' },
      GPS: { GPSLatitude: '19/1 25/1 4272/100', GPSLatitudeRef: 'N', GPSLongitude: '99/1 7/1 5952/100', GPSLongitudeRef: 'W' },
    })
    .jpeg()
    .toBuffer()
}

describe('guardarImagen', () => {
  test('borra los metadatos EXIF, incluida la ubicación GPS', async () => {
    const original = await jpegConGps()
    const metaOriginal = await sharp(original).metadata()
    assert.ok(metaOriginal.exif, 'la imagen de prueba debe traer EXIF para que la prueba valga')

    const { buffer } = await guardarYLeer(comoFile(original, 'foto.jpg', 'image/jpeg'))
    const meta = await sharp(buffer).metadata()

    assert.equal(meta.exif, undefined, 'el archivo guardado no debe conservar EXIF')
    assert.ok(!buffer.includes(Buffer.from('GPSLatitude')), 'no debe quedar rastro de GPS')
    assert.ok(!buffer.includes(Buffer.from('Telefono X')), 'no debe quedar el modelo del celular')
  })

  test('reduce las fotos grandes de celular', async () => {
    const { buffer } = await guardarYLeer(comoFile(await jpegConGps(), 'grande.jpg', 'image/jpeg'))
    const meta = await sharp(buffer).metadata()
    assert.ok(meta.width! <= 1600 && meta.height! <= 1600, `quedó en ${meta.width}x${meta.height}`)
    assert.equal(meta.format, 'jpeg')
  })

  test('convierte PNG a JPEG: sale un solo formato, venga lo que venga', async () => {
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#123456' },
    }).png().toBuffer()

    const { url, buffer } = await guardarYLeer(comoFile(png, 'captura.png', 'image/png'))
    assert.ok(url.endsWith('.jpg'))
    assert.equal((await sharp(buffer).metadata()).format, 'jpeg')
  })

  test('rechaza lo que no es imagen aunque diga que lo es', async () => {
    // Un ejecutable renombrado a .jpg con el mime falseado.
    const falso = Buffer.from('#!/bin/sh\nrm -rf /\n')
    await assert.rejects(
      () => guardarImagen(comoFile(falso, 'trampa.jpg', 'image/jpeg')),
      ImagenInvalida,
    )
  })

  test('rechaza tipos no permitidos', async () => {
    await assert.rejects(
      () => guardarImagen(comoFile(Buffer.from('%PDF-1.4'), 'doc.pdf', 'application/pdf')),
      /Solo se aceptan fotos/,
    )
  })

  test('rechaza archivos vacíos', async () => {
    await assert.rejects(
      () => guardarImagen(comoFile(Buffer.alloc(0), 'vacio.jpg', 'image/jpeg')),
      /vacío/,
    )
  })

  test('rechaza lo que pasa de 10 MB', async () => {
    const enorme = comoFile(Buffer.alloc(16), 'enorme.jpg', 'image/jpeg')
    Object.defineProperty(enorme, 'size', { value: LIMITE_BYTES + 1 })
    await assert.rejects(() => guardarImagen(enorme), /10 MB/)
  })

  test('cada archivo recibe un nombre propio', async () => {
    const foto = await jpegConGps()
    const a = await guardarYLeer(comoFile(foto, 'igual.jpg', 'image/jpeg'))
    const b = await guardarYLeer(comoFile(foto, 'igual.jpg', 'image/jpeg'))
    assert.notEqual(a.url, b.url, 'dos fotos con el mismo nombre no deben pisarse')
  })
})
