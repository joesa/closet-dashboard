#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import axe from 'axe-core'
import { launch as launchChrome } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'
import browserQualityCheck from './browser-quality-check.mjs'

const args = process.argv.slice(2)
const argValues = (flag) => args.flatMap((value, index) => value === flag && args[index + 1] ? [args[index + 1]] : [])
const requestedUrls = [...argValues('--url'), ...(process.env.QA_URLS || '').split(',')]
  .map((url) => url.trim())
  .filter(Boolean)
const useAdminBypass = args.includes('--admin-bypass')
const urls = requestedUrls.map((value) => {
  const url = new URL(value)
  if (useAdminBypass) {
    if (!process.env.ADMIN_BYPASS_SECRET) throw new Error('--admin-bypass requires ADMIN_BYPASS_SECRET')
    url.searchParams.set('admin_bypass', process.env.ADMIN_BYPASS_SECRET)
  }
  return url.toString()
})
const outputPath = path.resolve(process.cwd(), args.includes('--output') ? args[args.indexOf('--output') + 1] : 'audit-output/template-quality.json')
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome'

if (urls.length === 0) {
  console.error('Provide at least one --url <site> or comma-separated QA_URLS.')
  process.exit(2)
}

const initVitals = () => {
  window.__templateVitals = { cls: 0, lcp: 0 }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__templateVitals.cls += entry.value
    }
  }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    window.__templateVitals.lcp = entries.at(-1)?.startTime || 0
  }).observe({ type: 'largest-contentful-paint', buffered: true })
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const chrome = await launchChrome({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
const reports = []

try {
  for (const url of urls) {
    const safeUrl = new URL(url)
    safeUrl.searchParams.delete('admin_bypass')
    const displayUrl = safeUrl.toString()
    const page = await browser.newPage()
    await page.addInitScript(initVitals)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.addScriptTag({ content: axe.source })
    const axeResult = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    }))
    const mobile = await browserQualityCheck(page, { width: 390, height: 844 })
    const desktop = await browserQualityCheck(page, { width: 1440, height: 1000 })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload({ waitUntil: 'networkidle' })
    const reducedMotionFailures = await page.evaluate(() =>
      document.getAnimations().flatMap((animation) => {
        const target = animation.effect?.target
        const rootHost = target?.getRootNode?.()?.host
        if (target?.closest?.('nextjs-portal') || rootHost?.tagName === 'NEXTJS-PORTAL') return []
        const duration = Number(animation.effect?.getTiming().duration || 0)
        const keyframes = animation.effect?.getKeyframes?.() || []
        const moves = keyframes.some((frame) =>
          ['transform', 'translate', 'scale', 'rotate', 'offset', 'clipPath', 'filter'].some((property) => {
            const value = frame[property]
            return typeof value === 'string' && value !== '' && value !== 'none'
          }),
        )
        return Number.isFinite(duration) && duration > 50 && moves
          ? [{
              tag: target?.tagName || null,
              duration,
              name: animation.animationName || null,
              className: typeof target?.className === 'string' ? target.className.slice(0, 180) : null,
              html: target?.outerHTML?.slice(0, 300) || null,
            }]
          : []
      }),
    )

    const lighthouseResult = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility', 'performance'],
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
    })
    const lhr = lighthouseResult?.lhr
    const accessibilityScore = Number(lhr?.categories.accessibility?.score || 0)
    const lighthouseCls = Number(lhr?.audits['cumulative-layout-shift']?.numericValue || 0)
    const lighthouseLcp = Number(lhr?.audits['largest-contentful-paint']?.numericValue || 0)
    const failures = []
    const isLocalAudit = ['localhost', '127.0.0.1'].some((host) => new URL(url).hostname.endsWith(host))
    if (axeResult.violations.length) failures.push(`axe:${axeResult.violations.length}`)
    if (accessibilityScore < 0.95) failures.push(`lighthouse-a11y:${accessibilityScore}`)
    if (lighthouseCls >= 0.1) failures.push(`cls:${lighthouseCls}`)
    // Dev compilation and local image-proxy cold starts are not production LCP.
    // Still report the measurement locally; enforce the time budget on public URLs.
    if (!isLocalAudit && lighthouseLcp > 4000) failures.push(`lcp:${Math.round(lighthouseLcp)}ms`)
    if (!mobile.lcpImagePriority || !desktop.lcpImagePriority) failures.push('lcp-image-not-prioritized')
    if (mobile.horizontalOverflow || desktop.horizontalOverflow) failures.push('horizontal-overflow')
    if (mobile.focusFailures.length || desktop.focusFailures.length) failures.push('missing-focus-indicator')
    if (mobile.smallTargets.length || desktop.smallTargets.length) failures.push('small-interactive-target')
    if (mobile.spacingFailures.length || desktop.spacingFailures.length) failures.push('spacing-or-orphan-section')
    if (mobile.longLines.length || desktop.longLines.length) failures.push('line-length')
    if (reducedMotionFailures.length) failures.push('reduced-motion')

    reports.push({
      url: displayUrl,
      passed: failures.length === 0,
      failures,
      axe: axeResult.violations.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        nodes: nodes.slice(0, 20).map((node) => ({
          target: node.target,
          html: node.html.slice(0, 300),
          summary: node.failureSummary,
        })),
      })),
      lighthouse: { accessibilityScore, cls: lighthouseCls, lcp: lighthouseLcp },
      mobile,
      desktop,
      reducedMotionFailures,
    })
    await page.close()
  }
} finally {
  await browser.close()
  await chrome.kill()
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2)}\n`)
console.log(`Template quality report: ${outputPath}`)
for (const report of reports) console.log(`${report.passed ? 'PASS' : 'FAIL'} ${report.url}${report.failures.length ? ` (${report.failures.join(', ')})` : ''}`)
if (reports.some((report) => !report.passed)) process.exitCode = 1
