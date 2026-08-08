export default async function browserQualityCheck(page) {
  const width = Number(process.env.QA_VIEWPORT_WIDTH || 390)
  const height = Number(process.env.QA_VIEWPORT_HEIGHT || 844)
  await page.setViewportSize({ width, height })
  await page.reload({ waitUntil: 'networkidle' })

  return page.evaluate(({ expectedWidth, expectedHeight }) => {
    const parseRgb = (value) => (value.match(/[\d.]+/g) || []).map(Number)
    const luminance = (rgb) => {
      const channels = rgb.slice(0, 3).map((value) => value / 255)
        .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const contrast = (foreground, background) => {
      const light = Math.max(luminance(foreground), luminance(background))
      const dark = Math.min(luminance(foreground), luminance(background))
      return (light + 0.05) / (dark + 0.05)
    }
    const solidBackground = (element) => {
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (style.backgroundImage !== 'none') return null
        const color = parseRgb(style.backgroundColor)
        if (color.length >= 4 && color[3] > 0) return color
      }
      return [255, 255, 255, 1]
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.alt || image.currentSrc)
    const unnamedButtons = [...document.querySelectorAll('button')]
      .filter((button) => !(button.innerText || button.getAttribute('aria-label') || '').trim())
      .length
    const contrastFailures = [...document.querySelectorAll('body *')]
      .filter((element) => element.children.length === 0 && (element.textContent || '').trim())
      .flatMap((element) => {
        const style = getComputedStyle(element)
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return []
        const foreground = parseRgb(style.color)
        const background = solidBackground(element)
        if (foreground.length < 3 || !background) return []
        const ratio = contrast(foreground, background)
        const fontSize = Number.parseFloat(style.fontSize)
        const large = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700)
        if (ratio >= (large ? 3 : 4.5)) return []
        return [{
          tag: element.tagName,
          text: (element.textContent || '').trim().slice(0, 80),
          ratio: Number(ratio.toFixed(2)),
        }]
      })
      .slice(0, 20)
    const smallTargets = [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          (rect.width < 24 || rect.height < 24) && style.display !== 'inline'
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 60),
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      }))
      .slice(0, 20)

    return {
      viewport,
      viewportMatches: viewport.width === expectedWidth && viewport.height === expectedHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      footerCount: document.querySelectorAll('footer').length,
      brokenImages,
      unnamedButtons,
      contrastFailures,
      smallTargets,
      title: document.title,
    }
  }, { expectedWidth: width, expectedHeight: height })
}