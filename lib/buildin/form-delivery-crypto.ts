import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto"

const ALGO = "aes-256-gcm"

function getKey(): Uint8Array {
  const raw =
    process.env.FORM_DELIVERY_ENCRYPTION_KEY?.trim() ||
    process.env.BUILDIN_API_TOKEN?.trim() ||
    "dev-only-form-delivery-key-change-me"
  return new Uint8Array(createHash("sha256").update(raw).digest())
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

export function encryptManifestJson(value: unknown): {
  ciphertext: Uint8Array
  iv: Uint8Array
} {
  const iv = new Uint8Array(randomBytes(12))
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const enc = concatBytes(
    new Uint8Array(cipher.update(plain)),
    new Uint8Array(cipher.final())
  )
  const tag = new Uint8Array(cipher.getAuthTag())
  return { ciphertext: concatBytes(enc, tag), iv }
}

export function decryptManifestJson<T = unknown>(
  ciphertext: Uint8Array,
  iv: Uint8Array
): T {
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const data = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const plain = concatBytes(
    new Uint8Array(decipher.update(data)),
    new Uint8Array(decipher.final())
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function newAccessToken(): string {
  return randomBytes(32).toString("base64url")
}
