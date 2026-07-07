export function splitName(fullName: string) {
  if (!fullName) return { first: '', last: '' }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  const first = parts.shift() || ''
  const last = parts.join(' ')
  return { first, last }
}
