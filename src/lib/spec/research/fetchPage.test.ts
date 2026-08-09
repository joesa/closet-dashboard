import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPageText, prosePortion } from '@/lib/spec/research/fetchPage'

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.FIRECRAWL_API_KEY
})

/**
 * Observed on real pages: a Google Maps place URL scrapes to ~6,600 characters
 * that are entirely map-tile image URLs, and a login-walled Facebook page
 * scrapes to nav chrome. Both look like a healthy fetch if you only measure
 * length, and both cost a model call to be told there is nothing there.
 */
describe('prosePortion', () => {
  it('reduces a page of map tiles to nothing', () => {
    const tiles = Array.from(
      { length: 12 },
      () => '![](https://www.google.com/maps/vt/pb=!1m4!1m3!1i17!2i33758!3i51230!2m3!1e0!2sm)'
    ).join('')
    expect(prosePortion(tiles).length).toBeLessThan(20)
  })

  it('keeps link text while dropping the URLs around it', () => {
    expect(prosePortion('[Log in](https://facebook.com/login) to continue')).toBe(
      'Log in to continue'
    )
  })

  it('keeps genuine prose intact', () => {
    const about = 'We have run the same two crews out of Sango since 2011.'
    expect(prosePortion(about)).toBe(about)
  })

  it('strips bare URLs and table rules that inflate a length check', () => {
    expect(prosePortion('| --- | --- |\nSee https://example.com/x for details')).toBe(
      'See for details'
    )
  })
})

describe('fetchPageText — Facebook', () => {
  it('uses indexed snippets keyed by the numeric profile id instead of unsupported scrape', async () => {
    process.env.FIRECRAWL_API_KEY = 'test-key'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          data: {
            web: [
              {
                url: 'https://www.facebook.com/61590230650878/',
                title: 'Peerless Pressure & SoftWash | Clarksville TN',
                description:
                  'Professional pressure washing services for homes, driveways, sidewalks, fences, patios and more.',
              },
              {
                url: 'https://www.facebook.com/61590230650878/posts/122110868769341021/',
                title: 'Professional exterior cleaning services',
                description:
                  'Restore that clean, well-maintained look with house washing, driveways, and sidewalks.',
              },
              {
                url: 'https://www.facebook.com/unrelated/',
                title: 'Unrelated result',
                description: 'This must not enter the research source.',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPageText(
      'https://www.facebook.com/profile.php?id=61590230650878&sk=about',
      'facebook_about'
    )

    expect(result.error).toBeUndefined()
    expect(result.text).toContain('Professional pressure washing services')
    expect(result.text).not.toContain('Unrelated result')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0]).endsWith('/v1/search')).toBe(true)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      query: 'site:facebook.com "61590230650878"',
      limit: 5,
    })
  })
})
