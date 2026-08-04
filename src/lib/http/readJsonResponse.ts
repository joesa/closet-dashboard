/**
 * Read a fetch Response without ever surfacing a raw JSON parse error.
 *
 * Failures that happen *outside* our route handlers answer with plain text or
 * HTML, not JSON: Vercel's 413 for an oversized request body, a 502/504 from
 * the gateway, a platform error page. Calling `res.json()` on those throws
 * `Unexpected token 'R', "Request En"... is not valid JSON`, which is what a
 * prospect used to see on the intake form instead of "your photos are too
 * large". Every fetch on a customer-facing path should read through here so the
 * worst case is a sentence the customer can act on.
 */

export type JsonResponseResult<T> = {
  ok: boolean
  status: number
  data: T | null
  /** Human-readable message when `ok` is false; null on success. */
  error: string | null
}

/** Fallback copy for a failure whose body carried no usable `error` field. */
export function messageForStatus(status: number): string {
  if (status === 413) {
    return 'That submission is too large to send. Re-upload your largest photos and try again — if it keeps happening, remove a photo or two.'
  }
  if (status === 408 || status === 504 || status === 524) {
    return 'The server took too long to respond. Please try again.'
  }
  if (status === 429) {
    return 'Too many attempts in a short time. Please wait a minute and try again.'
  }
  if (status === 502 || status === 503) {
    return 'The server is temporarily unavailable. Please try again in a moment.'
  }
  if (status >= 500) {
    return 'Something went wrong on our end. Please try again — if it keeps failing, email us and we will finish this for you.'
  }
  if (status === 404) {
    return 'That link is no longer valid. Please reopen your intake link from your email.'
  }
  if (status >= 400) {
    return `We could not process that request (error ${status}). Please try again.`
  }
  return 'Unexpected response from the server. Please try again.'
}

/** Turn a thrown fetch error (offline, DNS, aborted) into customer-facing copy. */
export function describeFetchError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'The request was cancelled before it finished. Please try again.'
  }
  return 'Could not reach the server. Check your connection and try again — your answers are saved on this device.'
}

export async function readJsonResponse<T = unknown>(
  res: Response
): Promise<JsonResponseResult<T>> {
  let text = ''
  try {
    text = await res.text()
  } catch {
    text = ''
  }

  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  const bodyError =
    parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string'
      ? ((parsed as { error: string }).error.trim() || null)
      : null

  if (res.ok) {
    if (parsed !== null) {
      return { ok: true, status: res.status, data: parsed as T, error: null }
    }
    // 2xx with an unreadable body — treat as a failure rather than handing the
    // caller a null it will dereference.
    return {
      ok: false,
      status: res.status,
      data: null,
      error: 'Unexpected response from the server. Please try again.',
    }
  }

  return {
    ok: false,
    status: res.status,
    data: (parsed as T) ?? null,
    error: bodyError || messageForStatus(res.status),
  }
}
