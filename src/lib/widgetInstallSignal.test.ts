import { describe, expect, it } from 'vitest'
import { isPlatformOrigin, recordWidgetInstall } from '@/lib/widgetInstallSignal'

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
  /**
   * The contract that matters is that this NEVER affects the caller. It sits on
   * the widget's render path: the first version read its state from the
   * settings query, which put two ungranted columns into a query running as
   * `anon` and failed it outright — every embed 500'd and fell back to stock
   * closet pricing. So the tests pin "cannot throw, cannot block" rather than
   * the shape of the write.
   */
  it('does nothing for our own origins, without touching the database', async () => {
    await expect(
      recordWidgetInstall({ contractorId: 'c1', origin: 'https://ditchtheform.com' })
    ).resolves.toBeUndefined()
  })

  it('resolves quietly when the service role is unavailable', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      await expect(
        recordWidgetInstall({ contractorId: 'c1', origin: 'https://alvaradostile.com' })
      ).resolves.toBeUndefined()
    } finally {
      if (url) process.env.NEXT_PUBLIC_SUPABASE_URL = url
      if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key
    }
  })
})
