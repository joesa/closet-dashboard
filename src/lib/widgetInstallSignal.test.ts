import { describe, expect, it, vi } from 'vitest'
import { isPlatformOrigin, recordWidgetInstall } from '@/lib/widgetInstallSignal'

function fakeClient() {
  const eq = vi.fn(async () => ({ error: null }))
  const update = vi.fn((values: Record<string, unknown>) => {
    void values
    return { eq }
  })
  const from = vi.fn(() => ({ update }))
  return { client: { from }, update, eq }
}

/** The patch a call wrote, typed for assertions. */
function patchFrom(update: ReturnType<typeof fakeClient>['update']): Record<string, unknown> {
  const call = update.mock.calls[0]
  expect(call, 'expected an update to have been issued').toBeTruthy()
  return call![0]
}

describe('isPlatformOrigin', () => {
  it('treats our own hosts as not-an-install', () => {
    for (const origin of [
      'https://ditchtheform.com',
      'https://www.closetquotes.com',
      'https://closet-dashboard-abc.vercel.app',
      'http://localhost:3000',
    ]) {
      expect(isPlatformOrigin(origin), origin).toBe(true)
    }
  })

  it('treats a customer host as an install', () => {
    expect(isPlatformOrigin('https://alvaradostile.com')).toBe(false)
    expect(isPlatformOrigin('https://www.apexplumbing.co.uk')).toBe(false)
  })

  it('is conservative about a missing or malformed origin', () => {
    // No origin is a server-to-server or same-origin call, not evidence of an
    // install; recording one would show a contractor a green light they never
    // earned.
    expect(isPlatformOrigin(null)).toBe(true)
    expect(isPlatformOrigin('not a url')).toBe(true)
  })
})

describe('recordWidgetInstall', () => {
  const base = { contractorId: 'c1', installedAt: null, lastSeenOrigin: null }

  it('stamps the first sighting from a customer site', async () => {
    const { client, update } = fakeClient()
    await recordWidgetInstall({ ...base, supabase: client, origin: 'https://alvaradostile.com' })
    const patch = patchFrom(update)
    expect(patch.widget_installed_at).toBeTruthy()
    expect(patch.widget_last_seen_origin).toBe('https://alvaradostile.com')
  })

  it('does not write on a repeat view from the same origin', async () => {
    const { client, update } = fakeClient()
    await recordWidgetInstall({
      supabase: client,
      contractorId: 'c1',
      origin: 'https://alvaradostile.com',
      installedAt: '2026-08-01T00:00:00Z',
      lastSeenOrigin: 'https://alvaradostile.com',
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('records a move to a new origin without re-stamping the install date', async () => {
    const { client, update } = fakeClient()
    await recordWidgetInstall({
      supabase: client,
      contractorId: 'c1',
      origin: 'https://newsite.com',
      installedAt: '2026-08-01T00:00:00Z',
      lastSeenOrigin: 'https://oldsite.com',
    })
    const patch = patchFrom(update)
    expect(patch.widget_last_seen_origin).toBe('https://newsite.com')
    expect(patch.widget_installed_at).toBeUndefined()
  })

  it('ignores our own dashboard preview', async () => {
    const { client, update } = fakeClient()
    await recordWidgetInstall({ ...base, supabase: client, origin: 'https://ditchtheform.com' })
    expect(update).not.toHaveBeenCalled()
  })

  it('never throws when the write fails', async () => {
    const eq = vi.fn(async () => ({ error: { message: 'nope' } }))
    const client = { from: () => ({ update: () => ({ eq }) }) }
    await expect(
      recordWidgetInstall({ ...base, supabase: client, origin: 'https://alvaradostile.com' })
    ).resolves.toBeUndefined()
  })
})
