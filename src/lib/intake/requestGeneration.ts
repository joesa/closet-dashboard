type QueueResponse = { jobId?: string; statusUrl?: string; error?: string }

/**
 * Browser-side compatibility wrapper: enqueue generation, poll its durable
 * Graphile/Oracle job record, then return a normal JSON Response to callers.
 */
export async function requestIntakeGeneration(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<Response> {
  const queuedResponse = await fetch(input, init)
  if (queuedResponse.status !== 202) return queuedResponse

  const queued = (await queuedResponse.json().catch(() => ({}))) as QueueResponse
  if (!queued.jobId || !queued.statusUrl) {
    return new Response(JSON.stringify({ error: 'Generation queue returned an invalid response.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const started = Date.now()
  const timeoutMs = opts?.timeoutMs ?? 20 * 60 * 1000
  const intervalMs = opts?.intervalMs ?? 1500
  while (Date.now() - started < timeoutMs) {
    const statusResponse = await fetch(queued.statusUrl, { cache: 'no-store' })
    const status = await statusResponse.json().catch(() => ({}))
    if (!statusResponse.ok) return statusResponse
    if (status.status === 'succeeded') {
      return new Response(JSON.stringify(status.result ?? {}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (status.status === 'failed') {
      return new Response(JSON.stringify({ error: status.error || 'Generation failed.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return new Response(JSON.stringify({ error: 'Generation timed out waiting for the worker.' }), {
    status: 504,
    headers: { 'Content-Type': 'application/json' },
  })
}
