import { describe, it, expect } from 'vitest'
import { slugifySubdomain } from '@/lib/provision/resolveSubdomain'

describe('slugifySubdomain', () => {
  it('slugifies business names', () => {
    expect(slugifySubdomain('Apex Garage Builds!')).toBe('apex-garage-builds')
  })

  it('falls back for empty input', () => {
    expect(slugifySubdomain('   ')).toBe('site')
  })
})
