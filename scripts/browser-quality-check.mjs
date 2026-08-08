/** Browser-computed template QA. This complements siteValidator's SSR checks. */
export default async function browserQualityCheck(page, options = {}) {
  const width = Number(options.width || process.env.QA_VIEWPORT_WIDTH || 390)
  const height = Number(options.height || process.env.QA_VIEWPORT_HEIGHT || 844)
  await page.setViewportSize({ width, height })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(750)

  const result = await page.evaluate(({ expectedWidth, expectedHeight }) => {
    const visible = (element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.alt || image.currentSrc)
    const unnamedButtons = [...document.querySelectorAll('button')]
      .filter((button) => !(button.innerText || button.getAttribute('aria-label') || '').trim())
      .length
    const smallTargets = [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return (rect.width < 24 || rect.height < 24) && getComputedStyle(element).display !== 'inline'
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 60),
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      }))
      .slice(0, 20)

    const sections = [...document.querySelectorAll('main section')].filter(visible)
    const spacingFailures = sections.flatMap((section, index) => {
      const rect = section.getBoundingClientRect()
      const style = getComputedStyle(section)
      const previous = sections[index - 1]?.getBoundingClientRect()
      const failures = []
      if (rect.height < 48) failures.push({ index, reason: 'section-under-48px', height: Math.round(rect.height) })
      if (previous && rect.top < previous.bottom - 1) failures.push({ index, reason: 'section-overlap', overlap: Math.round(previous.bottom - rect.top) })
      const textLength = (section.textContent || '').replace(/\s+/g, ' ').trim().length
      const hasMedia = !!section.querySelector('img, video, canvas, iframe, form, [role="dialog"], closet-quote-widget, closet-order-widget, closet-booking-widget, closet-ticket-widget')
      const isHero = Boolean(section.querySelector('h1'))
      if (!isHero && textLength > 80 && Number.parseFloat(style.paddingTop) < 24 && Number.parseFloat(style.paddingBottom) < 24) {
        failures.push({ index, reason: 'content-section-under-padded' })
      }
      if (textLength < 12 && !hasMedia) failures.push({ index, reason: 'orphan-section' })
      return failures
    }).slice(0, 20)

    const longLines = [...document.querySelectorAll('main p')].filter(visible).flatMap((element) => {
      const style = getComputedStyle(element)
      const averageCharacterWidth = Number.parseFloat(style.fontSize) * 0.52
      const estimatedCharacters = element.getBoundingClientRect().width / Math.max(averageCharacterWidth, 1)
      return estimatedCharacters > 82
        ? [{ text: (element.textContent || '').trim().slice(0, 70), estimatedCharacters: Math.round(estimatedCharacters) }]
        : []
    }).slice(0, 20)

    const lcpImage = document.querySelector('main img[fetchpriority="high"], main img[fetchPriority="high"], link[rel="preload"][as="image"]')
    const engineRoot = document.querySelector('[data-engine-site]')
    const vitals = window.__templateVitals || { cls: 0, lcp: 0 }
    return {
      viewport,
      viewportMatches: viewport.width === expectedWidth && viewport.height === expectedHeight,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      footerCount: document.querySelectorAll('footer').length,
      brokenImages,
      unnamedButtons,
      smallTargets,
      spacingFailures,
      longLines,
      lcpImagePriority: Boolean(lcpImage),
      imageLayoutFailures: [...document.images].filter(visible).filter((image) => {
        const rect = image.getBoundingClientRect()
        return rect.width <= 0 || rect.height <= 0
      }).length,
      nextFontOnly: ![...document.styleSheets].some((sheet) => (sheet.href || '').includes('fonts.googleapis.com')),
      designSystemVersion: engineRoot?.getAttribute('data-engine-site') || null,
      focusStandard: engineRoot?.getAttribute('data-focus-standard') || null,
      cls: Number(vitals.cls || 0),
      lcp: Number(vitals.lcp || 0),
      title: document.title,
    }
  }, { expectedWidth: width, expectedHeight: height })

  const focusFailures = []
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      let element = document.activeElement
      while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
      if (!element || element === document.body) return null
      const rootHost = element.getRootNode()?.host
      if (element.closest?.('nextjs-portal') || rootHost?.tagName === 'NEXTJS-PORTAL' || element.textContent?.includes('Open Next.js Dev Tools')) {
        return { skip: true }
      }
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        tag: element.tagName,
        text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 60),
        visible: rect.width > 0 && rect.height > 0,
        hasIndicator: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
      }
    })
    if (focus?.visible && !focus.hasIndicator && !focus.skip) focusFailures.push(focus)
  }

  return { ...result, focusFailures }
}
