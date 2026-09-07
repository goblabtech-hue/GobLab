import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Reglas estructurales del CLAUDE.md, verificadas automáticamente.
 *
 * Una convención de arquitectura que nadie comprueba se degrada sola: basta un
 * `import` cómodo un martes por la tarde. Estas pruebas son el guardia.
 */

const RAIZ = path.join(process.cwd(), 'src')

function archivosDe(carpeta: string): string[] {
  const base = path.join(RAIZ, carpeta)
  if (!fs.existsSync(base)) return []
  const salida: string[] = []
  for (const entrada of fs.readdirSync(base, { withFileTypes: true, recursive: true })) {
    if (!entrada.isFile()) continue
    if (!/\.tsx?$/.test(entrada.name)) continue
    salida.push(path.join(entrada.parentPath ?? base, entrada.name))
  }
  return salida
}

const importacionesDe = (archivo: string): string[] =>
  [...fs.readFileSync(archivo, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g)]
    .map((m) => m[1] ?? m[2] ?? '')
    .filter(Boolean)

const relativo = (p: string) => path.relative(process.cwd(), p)

describe('el dominio no depende de la infraestructura', () => {
  test('ningún archivo de src/domain importa Prisma, Next ni otra capa', () => {
    const prohibidos = [
      '@/infrastructure', '@/application', '@/app', '@/components',
      'next/', '@prisma/', 'exceljs', 'nodemailer', 'next-auth',
    ]
    const faltas: string[] = []

    for (const archivo of archivosDe('domain')) {
      for (const imp of importacionesDe(archivo)) {
        if (prohibidos.some((p) => imp.startsWith(p))) {
          faltas.push(`${relativo(archivo)} importa ${imp}`)
        }
      }
    }
    assert.deepEqual(faltas, [], 'el dominio debe ser puro:\n' + faltas.join('\n'))
  })

  test('el dominio solo usa el cliente generado para tipos, nunca para consultar', () => {
    const faltas: string[] = []
    for (const archivo of archivosDe('domain')) {
      const texto = fs.readFileSync(archivo, 'utf8')
      // `import type` está bien: son los enums del esquema. `prisma.` no.
      if (/\bprisma\s*\./.test(texto)) faltas.push(relativo(archivo))
    }
    assert.deepEqual(faltas, [], 'archivos del dominio que consultan la base')
  })
})

describe('la aplicación no depende de la interfaz', () => {
  test('ningún caso de uso importa de src/app ni de src/components', () => {
    const faltas: string[] = []
    for (const carpeta of ['application', 'domain', 'infrastructure']) {
      for (const archivo of archivosDe(carpeta)) {
        for (const imp of importacionesDe(archivo)) {
          if (imp.startsWith('@/app/') || imp.startsWith('@/components')) {
            faltas.push(`${relativo(archivo)} importa ${imp}`)
          }
        }
      }
    }
    assert.deepEqual(faltas, [], 'las capas internas no deben conocer la interfaz')
  })
})

describe('tamaño de archivo (CLAUDE.md: ≤ 400 líneas)', () => {
  test('ningún archivo de dominio, aplicación o infraestructura pasa de 400 líneas', () => {
    const excedidos: string[] = []
    for (const carpeta of ['domain', 'application', 'infrastructure']) {
      for (const archivo of archivosDe(carpeta)) {
        const lineas = fs.readFileSync(archivo, 'utf8').split('\n').length
        if (lineas > 400) excedidos.push(`${relativo(archivo)}: ${lineas} líneas`)
      }
    }
    assert.deepEqual(excedidos, [], 'archivos que hay que dividir por responsabilidad')
  })
})

describe('estructura', () => {
  test('las cuatro capas existen', () => {
    for (const capa of ['domain', 'application', 'infrastructure', 'app']) {
      assert.ok(fs.existsSync(path.join(RAIZ, capa)), `falta src/${capa}`)
    }
  })

  test('no quedó una carpeta cajón de sastre', () => {
    assert.equal(
      fs.existsSync(path.join(RAIZ, 'lib')), false,
      'src/lib volvió a aparecer: cada módulo pertenece a una capa concreta',
    )
  })
})
