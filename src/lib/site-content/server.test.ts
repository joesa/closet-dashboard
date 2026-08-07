import { describe, expect, it } from 'vitest'
import { assertSameOriginMutation } from './server'

function mutationRequest(origin?: string) {
  return new Request('https://www.ditchtheform.com/api/dashboard/site-content', {
    method: 'PATCH',
    headers: origin ? { origin } : undefined,
  })
}

describe('assertSameOriginMutation', () => {
  it('accepts a direct same-origin dashboard mutation', () => {
    expect(
      assertSameOriginMutation(mutationRequest('https://www.ditchtheform.com'))
    ).toBe(true)
  })

  it('accepts an externally rewritten request from an authenticated tenant hostname', () => {
    expect(
      assertSameOriginMutation(
        mutationRequest('https://raw-tree-services.ditchtheform.com'),
        ['raw-tree-services.ditchtheform.com']
      )
    ).toBe(true)
  })

  it('rejects an origin that is not owned by the authenticated tenant', () => {
    expect(
      assertSameOriginMutation(
        mutationRequest('https://attacker.example'),
        ['raw-tree-services.ditchtheform.com']
      )
    ).toBe(false)
  })
})
