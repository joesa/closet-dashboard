import { describe, expect, it } from 'vitest'
import { buildDetailSyncChanges, detectBusinessDetailChanges } from './businessDetails'

const OLD_EMAIL = 'mohajaw324@hutdot.com'
const NEW_EMAIL = 'joesa@hutdot.com'

function page(email: string, phone: string, name = "Alvarado's Tile Installations") {
  return (
    `<header><a class="brand" href="/">${name}</a></header>` +
    `<main><h1>Contact</h1><p>Call us any time.</p>` +
    `<a href="tel:${phone.replace(/\D/g, '')}">${phone}</a>` +
    `<a href="mailto:${email}">${email}</a></main>` +
    `<footer><div class="footer-brand">${name}</div><a href="mailto:${email}">${email}</a></footer>`
  )
}

function site(email: string, phone = '931-278-2785') {
  return {
    '/': { html: page(email, phone) },
    '/about': { html: page(email, phone) },
    '/contact': { html: page(email, phone) },
  }
}

describe('detectBusinessDetailChanges', () => {
  it('spots an email edit and counts where the old one survives', () => {
    const previous = site(OLD_EMAIL)
    const next = { ...previous, '/contact': { html: page(NEW_EMAIL, '931-278-2785') } }

    const changes = detectBusinessDetailChanges(previous, next, '/contact')

    // One row, not two: the mailto: target is subsumed by the bare address.
    expect(changes).toHaveLength(1)
    // Each remaining page carries it 4× (text + mailto, in main and footer).
    expect(changes[0]).toMatchObject({ from: OLD_EMAIL, to: NEW_EMAIL, totalOccurrences: 8 })
    expect(changes[0].occurrences.map((o) => o.page).sort()).toEqual(['/', '/about'])
  })

  it('spots a phone edit even though the tel: href changes too', () => {
    const previous = site(OLD_EMAIL, '931-278-2785')
    const next = { ...previous, '/contact': { html: page(OLD_EMAIL, '931-555-0100') } }

    const changes = detectBusinessDetailChanges(previous, next, '/contact')
    const display = changes.find((c) => c.from === '931-278-2785')

    expect(display).toBeTruthy()
    expect(display!.to).toBe('931-555-0100')
    // The tel: target is reported as its own pair, not silently merged.
    expect(changes.some((c) => c.from.startsWith('tel:'))).toBe(true)
  })

  it('spots a business-name edit', () => {
    const previous = site(OLD_EMAIL)
    const next = { ...previous, '/contact': { html: page(OLD_EMAIL, '931-278-2785', 'Alvarado Tile Co.') } }

    const changes = detectBusinessDetailChanges(previous, next, '/contact')
    expect(changes[0]).toMatchObject({ from: "Alvarado's Tile Installations", to: 'Alvarado Tile Co.' })
  })

  it('stays quiet when the old value appears nowhere else', () => {
    const previous = { '/': { html: page(OLD_EMAIL, '931-278-2785') } }
    const next = { '/': { html: page(NEW_EMAIL, '931-278-2785') } }
    expect(detectBusinessDetailChanges(previous, next, '/')).toEqual([])
  })

  it('stays quiet for structural edits, where runs are added or removed', () => {
    const previous = site(OLD_EMAIL)
    const next = {
      ...previous,
      '/contact': { html: page(OLD_EMAIL, '931-278-2785').replace('<p>Call us any time.</p>', '') },
    }
    expect(detectBusinessDetailChanges(previous, next, '/contact')).toEqual([])
  })

  it('stays quiet for a bulk find-and-replace style rewrite', () => {
    const previous = site(OLD_EMAIL)
    const rewritten = page(OLD_EMAIL, '931-278-2785')
      .replace('Contact', 'Reach us')
      .replace('Call us any time.', 'Ring any time.')
      .replace(/Alvarado's Tile Installations/g, 'Alvarado Tile Co.')
      .replace(OLD_EMAIL, NEW_EMAIL)
    const changes = detectBusinessDetailChanges(previous, { ...previous, '/contact': { html: rewritten } }, '/contact', 2)
    expect(changes).toEqual([])
  })

  it('treats a value repeated across the page as one change, not many', () => {
    // Regression: Alvarado's phone appears 6× on a page. Counting raw
    // occurrences against the bulk-rewrite limit made detection return nothing
    // for exactly the edits this feature exists to catch.
    const repeated = (phone: string) =>
      `<header><a href="tel:x">${phone}</a></header>` +
      `<main>${Array.from({ length: 5 }, () => `<p>Call ${phone} today</p>`).join('')}</main>` +
      `<footer><span>${phone}</span></footer>`
    const previous = { '/': { html: repeated('931-278-2785') }, '/about': { html: repeated('931-278-2785') } }
    const next = { ...previous, '/': { html: repeated('931-555-0100') } }

    const changes = detectBusinessDetailChanges(previous, next, '/')
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ from: '931-278-2785', to: '931-555-0100' })
    expect(changes[0].occurrences).toEqual([{ page: '/about', count: 7 }])
  })

  it('ignores values too generic to be worth syncing', () => {
    const before = { '/': { html: '<p>Step 1</p><p>shared</p>' }, '/b': { html: '<p>Step 1</p>' } }
    const after = { '/': { html: '<p>Step 2</p><p>shared</p>' }, '/b': { html: '<p>Step 1</p>' } }
    expect(detectBusinessDetailChanges(before, after, '/')).toEqual([])
  })

  it('does not offer to sync an unchanged value', () => {
    const previous = site(OLD_EMAIL)
    expect(detectBusinessDetailChanges(previous, previous, '/contact')).toEqual([])
  })
})

describe('buildDetailSyncChanges', () => {
  it('rewrites every other page that still holds the old value', () => {
    const pages = site(OLD_EMAIL)
    const changes = [
      { from: OLD_EMAIL, to: NEW_EMAIL, occurrences: [], totalOccurrences: 0 },
    ]

    const ops = buildDetailSyncChanges(pages, changes, '/contact')

    expect(ops.map((op) => op.path).sort()).toEqual([
      '/custom_config/pages/~1/html',
      '/custom_config/pages/~1about/html',
    ])
    for (const op of ops) {
      expect(op.op).toBe('set')
      expect(String((op as { value: string }).value)).toContain(NEW_EMAIL)
      expect(String((op as { value: string }).value)).not.toContain(OLD_EMAIL)
    }
  })

  it('skips the edited page and pages without the old value', () => {
    const pages = { '/': { html: `<p>${OLD_EMAIL}</p>` }, '/other': { html: '<p>nothing here</p>' } }
    const ops = buildDetailSyncChanges(
      pages,
      [{ from: OLD_EMAIL, to: NEW_EMAIL, occurrences: [], totalOccurrences: 0 }],
      '/'
    )
    expect(ops).toEqual([])
  })
})
