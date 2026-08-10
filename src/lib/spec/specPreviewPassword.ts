import { createHmac } from 'node:crypto'

/**
 * The password a business types to see the site we built for them.
 *
 * The offer link is already unguessable, but it arrives by SMS and a text gets
 * forwarded. Requiring a password means the link alone is not enough — whoever
 * opens the site had to be holding the message.
 *
 * Derived rather than stored: there is no plaintext at rest anywhere. The
 * dashboard re-derives it whenever it needs to put it in a message, and the
 * renderer only ever compares hashes. Both sides share SPEC_PREVIEW_SECRET,
 * which already has to match for the preview token to work at all.
 */
function secret(): string {
  const value =
    process.env.SPEC_PREVIEW_SECRET?.trim() || process.env.CONTENT_EDITOR_SECRET?.trim()
  if (!value) throw new Error('SPEC_PREVIEW_SECRET is not configured')
  return value
}

/**
 * No O/0, I/1, S/5 — this gets read off a phone screen and typed by hand, and a
 * character somebody has to squint at is a support conversation.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXY2346789'

/** Stable for a given build: the same text can be re-sent and still work. */
export function derivePreviewPassword(specBuildId: string): string {
  const digest = createHmac('sha256', secret())
    .update(`spec-preview-pw:${specBuildId}`)
    .digest()

  let out = ''
  for (let i = 0; i < 8; i++) out += ALPHABET[digest[i] % ALPHABET.length]
  // Grouped for readability: HRTK-9PQW reads back over the phone far better
  // than an unbroken run of eight characters.
  return `${out.slice(0, 4)}-${out.slice(4)}`
}

export function hashPreviewPassword(password: string): string {
  return createHmac('sha256', secret())
    .update(`spec-preview-hash:${password.trim().toUpperCase()}`)
    .digest('base64url')
}
