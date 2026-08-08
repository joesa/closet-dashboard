/**
 * Deterministic surgical contact replacements (phone / email / address).
 * Site-wide string swaps must not depend on the LLM returning full page HTML.
 * Email/address HTML applies via cheerio replaceText; phone stays specialized.
 */

import { applyOpsToHtml, type SurgicalDomOp } from '@/lib/ai/surgicalDomOps'

export type SeoContactFields = {
  phone?: string
  email?: string
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  legalName?: string
}

export type ContactReplacePlan = {
  phone?: { fromDigits: string; toDigits: string; toDisplay: string }
  email?: { from: string; to: string; matchedFrom?: string }
  address?: {
    fromVariants: string[]
    toDisplay: string
    toSeo: Partial<SeoContactFields>
  }
  notes: string[]
}

const PHONE_DISPLAY_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

export function looksLikeContactSurgicalRequest(prompt: string): boolean {
  const p = prompt || ''
  const mentionsContact =
    /\b(phone|telephone|\btel\b|email|e-mail|mailto|address|street|zip(?:code)?|postal)\b/i.test(
      p
    )
  const asksChange =
    /\b(change|update|replace|set|swap|correct|fix|everywhere)\b/i.test(p) ||
    /\bto\b/i.test(p)
  return mentionsContact && asksChange
}

export function digitsOnlyPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return d
}

/** Format 10-digit US numbers as 931-436-1209; otherwise return trimmed input. */
export function formatPhoneDisplay(raw: string): string {
  const d = digitsOnlyPhone(raw)
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return (raw || '').trim()
}

function uniqueEmailsInText(text: string): string[] {
  const found = text.match(EMAIL_RE) || []
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of found) {
    const key = e.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

function mostCommonPhoneDigits(text: string): string | null {
  const counts = new Map<string, number>()
  for (const m of text.match(PHONE_DISPLAY_RE) || []) {
    const d = digitsOnlyPhone(m)
    if (d.length < 10) continue
    counts.set(d, (counts.get(d) || 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [d, n] of counts) {
    if (n > bestN) {
      best = d
      bestN = n
    }
  }
  return best
}

/** Levenshtein distance — used to recover admin typos in “old” email. */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase()
  const t = b.toLowerCase()
  const m = s.length
  const n = t.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      )
    }
  }
  return dp[m]![n]!
}

function resolveEmailFrom(
  requested: string | null,
  corpusEmails: string[],
  seoEmail: string | null
): { from: string; note?: string } | null {
  const pool = [
    ...corpusEmails,
    ...(seoEmail ? [seoEmail] : []),
  ]
  const uniq = [...new Map(pool.map((e) => [e.toLowerCase(), e])).values()]
  if (!uniq.length) return null

  if (requested) {
    const exact = uniq.find((e) => e.toLowerCase() === requested.toLowerCase())
    if (exact) return { from: exact }
    let best: string | null = null
    let bestDist = Infinity
    for (const e of uniq) {
      const d = editDistance(requested, e)
      if (d < bestDist) {
        bestDist = d
        best = e
      }
    }
    if (best && bestDist > 0 && bestDist <= 2) {
      return {
        from: best,
        note: `Email “${requested}” not found — matched similar “${best}” (typo?).`,
      }
    }
  }

  if (uniq.length === 1) {
    return {
      from: uniq[0]!,
      note: requested
        ? `Email “${requested}” not found — replaced the only site email (${uniq[0]}).`
        : undefined,
    }
  }

  if (seoEmail) {
    return {
      from: seoEmail,
      note: requested
        ? `Email “${requested}” not found — replaced seo_config email (${seoEmail}).`
        : undefined,
    }
  }

  return null
}

function parseUsAddress(raw: string): Partial<SeoContactFields> {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  // Standard: 1416 Wilshire Circle, Hopkinsville, KY 42240
  let m = cleaned.match(
    /^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i
  )
  if (m) {
    return {
      streetAddress: m[1]!.trim(),
      addressLocality: m[2]!.trim(),
      addressRegion: m[3]!.toUpperCase(),
      postalCode: m[4]!.trim(),
    }
  }
  // Admin often omits the comma after the street:
  // "2868 Summer Lawn Drive Clarksville, TN 37043"
  m = cleaned.match(
    /^(\d{1,6}\s+.+?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
  )
  if (m) {
    return {
      streetAddress: m[1]!.trim(),
      addressLocality: m[2]!.trim(),
      addressRegion: m[3]!.toUpperCase(),
      postalCode: m[4]!.trim(),
    }
  }
  return { streetAddress: cleaned }
}

function addressVariants(raw: string, seo?: SeoContactFields | null): string[] {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const variants = new Set<string>([cleaned])
  variants.add(cleaned.replace(/\.$/, ''))

  const fromParsed = parseUsAddress(cleaned)
  const street =
    (seo?.streetAddress && seo.streetAddress.trim()) ||
    fromParsed.streetAddress ||
    cleaned.split(',')[0]?.trim()
  if (street && street.length >= 8) variants.add(street)

  const locality = seo?.addressLocality || fromParsed.addressLocality
  const region = seo?.addressRegion || fromParsed.addressRegion
  const postal = seo?.postalCode || fromParsed.postalCode

  if (street && locality && region) {
    variants.add(`${street}, ${locality}, ${region}`)
    variants.add(`${street} ${locality}, ${region}`)
    if (postal) {
      variants.add(`${street}, ${locality}, ${region} ${postal}`)
      variants.add(`${street} ${locality}, ${region} ${postal}`)
      // Do NOT add bare "City, ST ZIP" — replacing those with a full street
      // address doubles lines when the footer is Street<br>City, ST ZIP.
    }
  }

  // Also seed from full seo block when present
  if (seo?.streetAddress && seo.addressLocality && seo.addressRegion) {
    const seoFull = [
      seo.streetAddress,
      seo.addressLocality,
      `${seo.addressRegion}${seo.postalCode ? ` ${seo.postalCode}` : ''}`,
    ].join(', ')
    variants.add(seoFull)
    variants.add(
      `${seo.streetAddress}, ${seo.addressLocality}, ${seo.addressRegion}`
    )
    variants.add(seo.streetAddress)
  }

  return [...variants].sort((a, b) => b.length - a.length)
}

/**
 * Parse admin prompt + live corpus into a replace plan.
 */
export function parseContactSurgicalRequest(
  prompt: string,
  opts: {
    htmlCorpus: string
    seo?: SeoContactFields | null
  }
): ContactReplacePlan | null {
  if (!looksLikeContactSurgicalRequest(prompt)) return null

  const notes: string[] = []
  const seo = opts.seo || {}
  const plan: ContactReplacePlan = { notes }

  const phoneToMatch =
    prompt.match(
      /\b(?:phone|telephone|tel)(?:\s+number)?[^\n]*?\bto\s+([+\d(][\d\s().-]{7,}\d)/i
    ) ||
    prompt.match(
      /\bchange(?:\s+everywhere)?[^\n]*?\bphone[^\n]*?\bto\s+([+\d(][\d\s().-]{7,}\d)/i
    )
  const phoneFromMatch = prompt.match(
    /\b(?:phone|telephone|tel)(?:\s+number)?\s+(?:from\s+)?([+\d(][\d\s().-]{7,}\d)\s+to\s+/i
  )

  if (phoneToMatch) {
    const toDisplay = formatPhoneDisplay(phoneToMatch[1]!)
    const toDigits = digitsOnlyPhone(toDisplay)
    if (toDigits.length >= 10) {
      const fromRaw =
        phoneFromMatch?.[1] ||
        (typeof seo.phone === 'string' ? seo.phone : '') ||
        mostCommonPhoneDigits(opts.htmlCorpus) ||
        ''
      const fromDigits = digitsOnlyPhone(fromRaw)
      if (fromDigits.length >= 10 && fromDigits !== toDigits) {
        plan.phone = { fromDigits, toDigits, toDisplay }
      } else if (fromDigits === toDigits) {
        notes.push('Phone already matches the requested number.')
      } else {
        notes.push(
          'Could not detect the current phone to replace — include the old number in the prompt.'
        )
      }
    }
  }

  const emailsInPrompt = uniqueEmailsInText(prompt)
  const emailPair =
    prompt.match(
      /\b(?:e-?mail)(?:\s+address)?[^\n]*?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s+to\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i
    ) || null
  let emailFrom = emailPair?.[1] || null
  let emailTo = emailPair?.[2] || null
  if (!emailTo && emailsInPrompt.length >= 2) {
    emailFrom = emailsInPrompt[0]!
    emailTo = emailsInPrompt[emailsInPrompt.length - 1]!
  } else if (!emailTo && emailsInPrompt.length === 1) {
    // "change email to X" with no old
    emailTo = emailsInPrompt[0]!
    emailFrom = null
  }

  if (emailTo) {
    const resolved = resolveEmailFrom(
      emailFrom,
      uniqueEmailsInText(opts.htmlCorpus),
      typeof seo.email === 'string' ? seo.email : null
    )
    if (resolved) {
      if (resolved.from.toLowerCase() !== emailTo.toLowerCase()) {
        plan.email = {
          from: resolved.from,
          to: emailTo,
          matchedFrom: emailFrom || undefined,
        }
        if (resolved.note) notes.push(resolved.note)
      } else {
        notes.push('Email already matches the requested address.')
      }
    } else {
      notes.push('Could not find an email on the site to replace.')
    }
  }

  const addrPair =
    prompt.match(
      /\baddress\s+['"]([^'"]+)['"]\s+to\s+['"]([^'"]+)['"]/i
    ) ||
    prompt.match(
      /\baddress\s+([^\n]+?)\s+to\s+([^\n]+?)(?:\n|$)/i
    )
  if (addrPair) {
    const fromRaw = addrPair[1]!.replace(/^['"]|['"]$/g, '').trim()
    const toRaw = addrPair[2]!.replace(/^['"]|['"]$/g, '').trim()
    // Stop "to" capture at next instruction line if greedy
    const toClean = toRaw.split(/\n/)[0]!.trim()
    if (fromRaw.length >= 6 && toClean.length >= 6) {
      plan.address = {
        fromVariants: addressVariants(fromRaw, seo),
        toDisplay: toClean.replace(/\s+/g, ' '),
        toSeo: parseUsAddress(toClean),
      }
    }
  }

  if (!plan.phone && !plan.email && !plan.address) return null
  return plan
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace every display/tel form of fromDigits with the new phone. */
export function replacePhoneInText(
  text: string,
  fromDigits: string,
  toDigits: string,
  toDisplay: string
): string {
  if (!text || fromDigits.length < 10) return text
  // tel:/sms: first — keep digit-only hrefs.
  let out = text.replace(
    new RegExp(
      `(tel:|sms:)(?:\\+?1)?\\s*${fromDigits.split('').join('\\s*')}`,
      'gi'
    ),
    `$1${toDigits}`
  )
  out = out.replace(PHONE_DISPLAY_RE, (match, offset, full) => {
    const digits = digitsOnlyPhone(match)
    if (digits !== fromDigits) return match
    const prefix = String(full)
      .slice(Math.max(0, offset - 6), offset)
      .toLowerCase()
    // Already handled inside tel:/sms: — do not pretty-print the href.
    if (/(?:tel:|sms:)(?:\+?1)?$/.test(prefix)) return match
    return toDisplay
  })
  if (fromDigits !== toDigits) {
    out = out.replace(new RegExp(fromDigits, 'g'), (match, offset, full) => {
      const prefix = String(full)
        .slice(Math.max(0, offset - 6), offset)
        .toLowerCase()
      if (/(?:tel:|sms:)(?:\+?1)?$/.test(prefix)) return match
      return toDigits
    })
  }
  return out
}

export function replaceEmailInText(
  text: string,
  from: string,
  to: string
): string {
  if (!text || !from) return text
  const re = new RegExp(escapeRegExp(from), 'gi')
  return text.replace(re, to)
}

export function replaceAddressInText(
  text: string,
  fromVariants: string[],
  toDisplay: string
): string {
  if (!text || !fromVariants.length) return text
  let out = text
  for (const v of fromVariants) {
    if (v.length < 4) continue
    out = out.replace(new RegExp(escapeRegExp(v), 'gi'), toDisplay)
  }
  return out
}

export type ContactReplaceResult = {
  pages: Record<
    string,
    {
      html: string
      title?: string
      description?: string
      changed: boolean
    }
  >
  globalCssChanged: boolean
  globalCss: string
  seo: SeoContactFields
  changedPages: string[]
  summaryParts: string[]
  notes: string[]
}

function applyAllContactReplaces(
  text: string,
  plan: ContactReplacePlan
): string {
  let out = text
  if (plan.phone) {
    out = replacePhoneInText(
      out,
      plan.phone.fromDigits,
      plan.phone.toDigits,
      plan.phone.toDisplay
    )
  }
  // Email stays string-wide so mailto:/href forms update too.
  if (plan.email) {
    out = replaceEmailInText(out, plan.email.from, plan.email.to)
  }
  if (plan.address) {
    const ops: SurgicalDomOp[] = plan.address.fromVariants
      .filter((v) => v.length >= 4)
      .map((v) => ({
        op: 'replaceText' as const,
        find: v,
        replace: plan.address!.toDisplay,
      }))
    if (ops.length && /<[a-zA-Z]/.test(out)) {
      out = applyOpsToHtml(out, ops).html
    } else if (ops.length) {
      out = replaceAddressInText(
        out,
        plan.address.fromVariants,
        plan.address.toDisplay
      )
    }
  }
  return out
}

/**
 * Apply a contact plan across custom pages + seo_config.
 */
export function applyContactReplacePlan(opts: {
  pages: Record<
    string,
    { html?: string; css?: string; title?: string; description?: string }
  >
  globalCss?: string
  seo?: SeoContactFields | null
  plan: ContactReplacePlan
}): ContactReplaceResult {
  const seo: SeoContactFields = { ...(opts.seo || {}) }
  const notes = [...(opts.plan.notes || [])]
  const summaryParts: string[] = []
  const pageOut: ContactReplaceResult['pages'] = {}
  const changedPages: string[] = []

  let globalCss = opts.globalCss || ''
  const cssBefore = globalCss

  for (const [path, page] of Object.entries(opts.pages || {})) {
    const htmlBefore = page.html || ''
    const titleBefore = page.title || ''
    const descBefore = page.description || ''
    const html = applyAllContactReplaces(htmlBefore, opts.plan)
    const title = titleBefore
      ? applyAllContactReplaces(titleBefore, opts.plan)
      : titleBefore
    const description = descBefore
      ? applyAllContactReplaces(descBefore, opts.plan)
      : descBefore
    const changed =
      html !== htmlBefore || title !== titleBefore || description !== descBefore
    pageOut[path] = {
      html,
      title: title || undefined,
      description: description || undefined,
      changed,
    }
    if (changed) changedPages.push(path)
  }

  if (opts.plan.phone) {
    globalCss = replacePhoneInText(
      globalCss,
      opts.plan.phone.fromDigits,
      opts.plan.phone.toDigits,
      opts.plan.phone.toDisplay
    )
    seo.phone = opts.plan.phone.toDigits
    summaryParts.push(`phone → ${opts.plan.phone.toDisplay}`)
  }
  if (opts.plan.email) {
    globalCss = replaceEmailInText(
      globalCss,
      opts.plan.email.from,
      opts.plan.email.to
    )
    seo.email = opts.plan.email.to
    summaryParts.push(`email → ${opts.plan.email.to}`)
  }
  if (opts.plan.address) {
    for (const v of opts.plan.address.fromVariants) {
      globalCss = replaceAddressInText(
        globalCss,
        [v],
        opts.plan.address.toDisplay
      )
    }
    Object.assign(seo, opts.plan.address.toSeo)
    summaryParts.push(`address → ${opts.plan.address.toDisplay}`)
  }

  return {
    pages: pageOut,
    globalCss,
    globalCssChanged: globalCss !== cssBefore,
    seo,
    changedPages,
    summaryParts,
    notes,
  }
}
