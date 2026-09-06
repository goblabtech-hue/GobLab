import crypto from 'node:crypto'

/**
 * Manejo de teléfonos de contacto.
 *
 * CORRECCIÓN C-05 (ver DECISIONES.md): el SPEC pide el teléfono
 * "cifrado/enmascarado" pero no declara llave ni explica cómo el bot puede
 * buscar "los reportes ligados a ese teléfono" (SPEC §4.1) sobre datos
 * cifrados. Un cifrado autenticado produce texto distinto cada vez, así que
 * no se puede consultar por igualdad. Se guardan tres derivados:
 *
 *   hash     HMAC-SHA256 determinista  -> búsqueda por teléfono, sin descifrar
 *   cifrado  AES-256-GCM               -> solo se descifra para rol operador+
 *   mascara  "81••••1212"              -> listas internas sin descifrar nada
 *
 * Ninguno de los tres sale jamás por un endpoint público (SPEC §5, criterio 7).
 */

const ALGORITMO = 'aes-256-gcm'

function llave(): Buffer {
  const raw = process.env.PHONE_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'Falta PHONE_ENCRYPTION_KEY. Genérala con: openssl rand -base64 32',
    )
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('PHONE_ENCRYPTION_KEY debe ser de 32 bytes en base64.')
  }
  return buf
}

/** Deja solo dígitos y quita la lada de país mexicana si viene incluida. */
export function normalizarTelefono(entrada: string): string {
  let d = entrada.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3) // +52 1 nnnnnnnnnn
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d
}

export function telefonoValido(entrada: string): boolean {
  return normalizarTelefono(entrada).length === 10
}

export function hashTelefono(entrada: string): string {
  return crypto
    .createHmac('sha256', llave())
    .update(normalizarTelefono(entrada))
    .digest('hex')
}

export function cifrarTelefono(entrada: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITMO, llave(), iv)
  const ct = Buffer.concat([
    cipher.update(normalizarTelefono(entrada), 'utf8'),
    cipher.final(),
  ])
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ct.toString('base64'),
  ].join('.')
}

export function descifrarTelefono(payload: string): string {
  const [iv, tag, ct] = payload.split('.')
  if (!iv || !tag || !ct) throw new Error('Teléfono cifrado con formato inválido.')
  const decipher = crypto.createDecipheriv(
    ALGORITMO,
    llave(),
    Buffer.from(iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ct, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/** "8112341212" -> "81••••1212" (formato del SPEC §7). */
export function enmascararTelefono(entrada: string): string {
  const d = normalizarTelefono(entrada)
  if (d.length < 6) return '••••'
  return `${d.slice(0, 2)}${'•'.repeat(Math.max(0, d.length - 6))}${d.slice(-4)}`
}

export type TelefonoDerivados = {
  telefonoHash: string
  telefonoCifrado: string
  telefonoMascara: string
}

/** Los tres derivados de golpe, listos para guardar. */
export function derivarTelefono(entrada: string): TelefonoDerivados {
  return {
    telefonoHash: hashTelefono(entrada),
    telefonoCifrado: cifrarTelefono(entrada),
    telefonoMascara: enmascararTelefono(entrada),
  }
}
