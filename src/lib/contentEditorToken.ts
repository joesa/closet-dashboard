import { createHmac } from 'node:crypto'

function secret() {
  const value = process.env.CONTENT_EDITOR_SECRET?.trim() || process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!value) throw new Error('CONTENT_EDITOR_SECRET is not configured')
  return value
}

export function mintContentEditorToken(tenantId: string, userId: string, ttlSeconds = 15 * 60) {
  const payload = Buffer.from(JSON.stringify({ tenantId, userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url')
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

