import { describe, it, expect } from 'vitest'

// Light unit coverage for dollar parsing used by marketBounds research.
function parseDollarAmounts(text: string): number[] {
  const amounts: number[] = []
  const re =
    /\$\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?!\d)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 15 && n <= 100_000) amounts.push(n)
  }
  return amounts
}

describe('marketBounds dollar parsing', () => {
  it('extracts mid-market dollar amounts', () => {
    const text = 'Typical drain cleaning costs $129–$249 in Austin. Premium jobs hit $485.'
    expect(parseDollarAmounts(text)).toEqual([129, 249, 485])
  })

  it('ignores tiny and huge outliers', () => {
    expect(parseDollarAmounts('only $5 here')).toEqual([])
    expect(parseDollarAmounts('quote is $250000 for a stadium')).toEqual([])
  })
})
