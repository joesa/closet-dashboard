import { describe, expect, it } from 'vitest'
import {
  applyContactReplacePlan,
  digitsOnlyPhone,
  editDistance,
  formatPhoneDisplay,
  looksLikeContactSurgicalRequest,
  parseContactSurgicalRequest,
  replaceEmailInText,
  replacePhoneInText,
} from './surgicalContactReplace'

const sampleHtml = `
<footer>
  Call <a href="tel:9315511032">931-551-1032</a>
  or email fojep26648@apdtax.com
  · 2868 Summer Lawn Drive, Clarksville, TN 37043
</footer>
<p>Visit 2868 Summer Lawn Drive in Clarksville.</p>
`

describe('looksLikeContactSurgicalRequest', () => {
  it('detects phone/email/address change prompts', () => {
    expect(
      looksLikeContactSurgicalRequest(
        'Change everywhere the phone number to 931-436-1209'
      )
    ).toBe(true)
    expect(looksLikeContactSurgicalRequest('Make the hero bigger')).toBe(false)
  })
})

describe('parse + apply contact surgical', () => {
  const prompt = `Change everywhere the phone number attached appears to 931-436-1209
Change everywhere address '2868 Summer Lawn Drive Clarksville, TN 37043' to '1416 Wilshire Circle, Hopkinsville, KY 42240'
Change everywhere email address fojep28648@apdtax.com to charleskyei82@gmail.com`

  it('parses phone/email/address and recovers email typo', () => {
    const plan = parseContactSurgicalRequest(prompt, {
      htmlCorpus: sampleHtml,
      seo: {
        phone: '9315511032',
        email: 'fojep26648@apdtax.com',
        streetAddress: '2868 Summer Lawn Drive',
        addressLocality: 'Clarksville',
        addressRegion: 'TN',
        postalCode: '37043',
      },
    })
    expect(plan).not.toBeNull()
    expect(plan!.phone?.toDigits).toBe('9314361209')
    expect(plan!.phone?.fromDigits).toBe('9315511032')
    expect(plan!.email?.to).toBe('charleskyei82@gmail.com')
    expect(plan!.email?.from.toLowerCase()).toBe('fojep26648@apdtax.com')
    expect(plan!.notes.some((n) => /typo|similar/i.test(n))).toBe(true)
    expect(plan!.address?.toSeo.addressLocality).toBe('Hopkinsville')
    expect(plan!.address?.toSeo.addressRegion).toBe('KY')
    expect(plan!.address?.toSeo.postalCode).toBe('42240')
    expect(plan!.address?.fromVariants.some((v) => v === 'Clarksville, TN')).toBe(
      false
    )
  })

  it('replaces phone display + tel: href', () => {
    const out = replacePhoneInText(
      sampleHtml,
      '9315511032',
      '9314361209',
      '931-436-1209'
    )
    expect(out).toContain('tel:9314361209')
    expect(out).toContain('931-436-1209')
    expect(out).not.toContain('931-551-1032')
    expect(out).not.toContain('tel:9315511032')
  })

  it('applies across pages, titles, and seo without doubling city lines', () => {
    const plan = parseContactSurgicalRequest(prompt, {
      htmlCorpus: sampleHtml,
      seo: {
        phone: '9315511032',
        email: 'fojep26648@apdtax.com',
        streetAddress: '2868 Summer Lawn Drive',
        addressLocality: 'Clarksville',
        addressRegion: 'TN',
        postalCode: '37043',
      },
    })!
    const stacked = `<p>2868 Summer Lawn Drive<br>Clarksville, TN 37043</p>`
    const result = applyContactReplacePlan({
      pages: {
        '/': { html: sampleHtml },
        '/contact': {
          html: stacked,
          description: 'Call 931-551-1032 for help',
        },
      },
      seo: {
        phone: '9315511032',
        email: 'fojep26648@apdtax.com',
        streetAddress: '2868 Summer Lawn Drive',
        addressLocality: 'Clarksville',
        addressRegion: 'TN',
        postalCode: '37043',
      },
      plan,
    })
    expect(result.changedPages.sort()).toEqual(['/', '/contact'])
    expect(result.pages['/']!.html).toContain('931-436-1209')
    expect(result.pages['/']!.html).toContain('charleskyei82@gmail.com')
    expect(result.pages['/']!.html).toContain('1416 Wilshire Circle')
    expect(result.pages['/']!.html).not.toContain('fojep26648@apdtax.com')
    expect(result.pages['/contact']!.description).toContain('931-436-1209')
    // Street line updates; city line left alone (not replaced with full address)
    expect(result.pages['/contact']!.html).toContain(
      '1416 Wilshire Circle, Hopkinsville, KY 42240'
    )
    expect(
      (
        result.pages['/contact']!.html.match(
          /1416 Wilshire Circle, Hopkinsville, KY 42240/g
        ) || []
      ).length
    ).toBe(1)
    expect(result.seo.phone).toBe('9314361209')
    expect(result.seo.email).toBe('charleskyei82@gmail.com')
    expect(result.seo.addressLocality).toBe('Hopkinsville')
  })
})

describe('helpers', () => {
  it('formats and digit-normalizes phones', () => {
    expect(digitsOnlyPhone('(931) 551-1032')).toBe('9315511032')
    expect(formatPhoneDisplay('9314361209')).toBe('931-436-1209')
  })

  it('editDistance recovers near typos', () => {
    expect(editDistance('fojep28648@apdtax.com', 'fojep26648@apdtax.com')).toBe(
      1
    )
  })

  it('replaceEmailInText is case-insensitive', () => {
    expect(
      replaceEmailInText('Mail FOJEP26648@APDTAX.COM now', 'fojep26648@apdtax.com', 'x@y.com')
    ).toBe('Mail x@y.com now')
  })
})
