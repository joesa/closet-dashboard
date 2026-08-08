import { describe, expect, it } from 'vitest'
import { selectTemplateCanaries } from './templateCanaries'

describe('selectTemplateCanaries', () => {
  it('deduplicates tenants and covers distinct engagement models', () => {
    const result = selectTemplateCanaries([
      { tenantId: 'a', hostname: 'custom.example.com', engagementModel: 'quote', isPrimary: false, source: 'byo' },
      { tenantId: 'a', hostname: 'alpha.ditchtheform.com', engagementModel: 'quote', isPrimary: true, source: 'platform_subdomain' },
      { tenantId: 'b', hostname: 'beta.ditchtheform.com', engagementModel: 'booking', isPrimary: true, source: 'platform_subdomain' },
    ])
    expect(result).toEqual([
      { url: 'https://alpha.ditchtheform.com', engagementModel: 'quote' },
      { url: 'https://beta.ditchtheform.com', engagementModel: 'booking' },
    ])
  })

  it('rejects malformed hostnames', () => {
    expect(selectTemplateCanaries([
      { tenantId: 'a', hostname: 'https://evil.example/x', engagementModel: 'quote', isPrimary: true, source: 'byo' },
      { tenantId: 'b', hostname: 'fixture.localhost', engagementModel: 'booking', isPrimary: true, source: 'platform_subdomain' },
    ])).toEqual([])
  })
})
