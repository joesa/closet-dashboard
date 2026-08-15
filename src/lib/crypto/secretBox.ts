import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

/**
 * Symmetric encryption for secrets we have to store in Postgres.
 *
 * Provider API keys are entered by an admin in the browser and used later by
 * both Vercel and the VM worker, so they cannot live in env alone. Encrypting
 * under a key that only exists in the environment means a database dump — or
 * anyone with `is_admin()` SELECT — still cannot read them.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
 * than silently producing garbage that we would then send to a vendor as a
 * bearer token.
 *
 * Server-only — never import in client components.
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
/** Bumped only if the format changes; lets old rows decrypt after a migration. */
const VERSION = 'v1'

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

/**
 * The KEK, from AI_CONFIG_KEY (base64 or hex, 32 bytes).
 *
 * Read per call rather than cached at module load: the worker and Next both
 * load .env files at different points, and a module-level read would freeze in
 * whatever value existed at import time.
 */
function getKey(): Buffer {
  const raw = process.env.AI_CONFIG_KEY?.trim()
  if (!raw) {
    throw new SecretBoxError(
      'AI_CONFIG_KEY is not set — cannot encrypt or decrypt stored provider credentials. Generate one with: openssl rand -base64 32'
    )
  }

  let key: Buffer
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }

  if (key.length !== KEY_BYTES) {
    throw new SecretBoxError(
      `AI_CONFIG_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    )
  }
  return key
}

/** Whether a KEK is configured and usable. Never throws — callers gate on this. */
export function secretBoxConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

/**
 * Encrypt to a self-describing string: `v1.<iv>.<tag>.<ciphertext>`, all
 * base64url. One column, no side-channel metadata to keep in sync.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new SecretBoxError('Refusing to encrypt an empty secret')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

/**
 * Decrypt a value produced by encryptSecret. Throws SecretBoxError on a wrong
 * key, a tampered payload, or an unknown format — callers in generation paths
 * catch and skip the provider rather than failing the job.
 */
export function decryptSecret(payload: string): string {
  const parts = payload?.split('.') ?? []
  if (parts.length !== 4) {
    throw new SecretBoxError('Malformed encrypted secret (expected 4 segments)')
  }
  const [version, ivB64, tagB64, dataB64] = parts
  if (version !== VERSION) {
    throw new SecretBoxError(`Unsupported secret format "${version}"`)
  }

  const iv = Buffer.from(ivB64!, 'base64url')
  const tag = Buffer.from(tagB64!, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretBoxError('Malformed encrypted secret (bad iv or tag length)')
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64!, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch (err) {
    if (err instanceof SecretBoxError) throw err
    // GCM auth failure — wrong key or tampered payload. Deliberately does not
    // echo the underlying message, which varies by Node version and says
    // nothing actionable.
    throw new SecretBoxError(
      'Could not decrypt stored secret — AI_CONFIG_KEY may have changed since it was saved'
    )
  }
}

/** Last 4 characters, for showing which key is stored without revealing it. */
export function secretHint(plaintext: string): string {
  return plaintext.length <= 4 ? '••••' : `••••${plaintext.slice(-4)}`
}

/** Constant-time compare for secrets we do check directly (e.g. test tokens). */
export function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
