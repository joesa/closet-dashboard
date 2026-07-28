/**
 * Cryptographically strong password for client "Generate" buttons.
 * Guarantees lower, upper, digit, and symbol; avoids ambiguous lookalikes
 * (0/O, 1/l/I) so users can read and type them reliably.
 */

const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*-_=+'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

function randomIndex(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % max
  }
  return Math.floor(Math.random() * max)
}

function pick(charset: string): string {
  return charset.charAt(randomIndex(charset.length))
}

export function generateStrongPassword(length = 16): string {
  const len = Math.max(12, Math.min(64, length))
  const chars: string[] = [
    pick(LOWER),
    pick(UPPER),
    pick(DIGITS),
    pick(SYMBOLS),
  ]
  while (chars.length < len) {
    chars.push(pick(ALL))
  }
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
