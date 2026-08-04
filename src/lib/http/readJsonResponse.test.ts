import { describe, expect, it } from 'vitest'
import { messageForStatus, readJsonResponse } from './readJsonResponse'

const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

describe('readJsonResponse', () => {
  it('returns parsed data on success', async () => {
    const res = new Response(JSON.stringify({ success: true, provisionQueued: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await readJsonResponse<{ provisionQueued: boolean }>(res)
    expect(result.ok).toBe(true)
    expect(result.data?.provisionQueued).toBe(true)
    expect(result.error).toBeNull()
  })

  it('never leaks a parse error for a plain-text 413 (the Vercel body-limit case)', async () => {
    // This is the literal body Vercel returns when the request exceeds the
    // serverless body limit — `res.json()` on it throws "Unexpected token 'R'".
    const result = await readJsonResponse(textResponse('Request Entity Too Large', 413))
    expect(result.ok).toBe(false)
    expect(result.status).toBe(413)
    expect(result.error).toBe(messageForStatus(413))
    expect(result.error).toMatch(/too large/i)
    expect(result.error).not.toMatch(/JSON|token/i)
  })

  it('prefers our own route error message over the status fallback', async () => {
    const res = new Response(JSON.stringify({ error: 'Select at least one service you offer.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await readJsonResponse(res)
    expect(result.error).toBe('Select at least one service you offer.')
  })

  it('handles an HTML gateway error page', async () => {
    const result = await readJsonResponse(
      new Response('<html><body>502 Bad Gateway</body></html>', { status: 502 })
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/temporarily unavailable/i)
  })

  it('treats a 2xx with an unreadable body as a failure, not null data', async () => {
    const result = await readJsonResponse(textResponse('', 200))
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toMatch(/Unexpected response/i)
  })

  it('falls back to a blank-body error message on an empty 500', async () => {
    const result = await readJsonResponse(textResponse('', 500))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/went wrong on our end/i)
  })
})
