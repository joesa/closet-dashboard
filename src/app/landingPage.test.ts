import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BG, INK_3, SURFACE_2 } from '@/lib/landingTheme'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8')
const loginSource = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf8')
const getStartedSource = fs.readFileSync(path.join(process.cwd(), 'src/app/get-started/page.tsx'), 'utf8')

function channel(hex: string, start: number) {
  return Number.parseInt(hex.slice(start, start + 2), 16) / 255
}

function luminance(hex: string) {
  const linear = [channel(hex, 1), channel(hex, 3), channel(hex, 5)].map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('marketing homepage quality contract', () => {
  it('keeps quiet text WCAG AA on every landing surface', () => {
    expect(contrast(INK_3, BG)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(INK_3, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(INK_3, SURFACE_2)).toBeGreaterThanOrEqual(4.5)
  })

  it('uses semantic structure and honest design-study language', () => {
    expect(pageSource).toContain('<main>')
    expect(pageSource).toContain('</main>')
    expect(pageSource).toContain('not customer proof and not a template we copy')
    expect(pageSource).not.toContain('your build starts from the one you pick')
    expect(pageSource).not.toContain('service businesses across six trades')
  })

  it('sells customer outcomes instead of AI implementation machinery', () => {
    for (const tell of [
      'AI-written selling copy',
      'Custom AI hero',
      'AI-looking renders',
      'Firecrawl-informed',
      'no blank or placeholder content',
    ]) {
      expect(pageSource).not.toContain(tell)
    }
    expect(pageSource).toContain('Custom Studio')
    expect(pageSource).not.toContain('tier=ai_premium')
    expect(pageSource).toContain('tier=custom_studio')
    expect(getStartedSource).toContain("tierParam === 'custom_studio'")
    expect(getStartedSource).toContain('Custom Studio site build')
  })

  it('never transports the public demo password in a URL', () => {
    expect(pageSource).toContain("const demoLoginHref = '/login?demo=1'")
    expect(pageSource).not.toMatch(/login\?email=.*password=/)
    expect(loginSource).toContain("searchParams.get('demo') === '1'")
  })
})
