import { describe, expect, it } from 'vitest'
import { tenantOwnedExtraOrigin } from './revalidateTenantSite'

describe('tenantOwnedExtraOrigin', () => {
  const tenantHosts = ['raw-tree-services.ditchtheform.com', 'rawtrees.example']

  it('accepts only an origin attached to the tenant being invalidated', () => {
    expect(tenantOwnedExtraOrigin('https://RAW-TREE-SERVICES.ditchtheform.com/dashboard', tenantHosts))
      .toBe('https://raw-tree-services.ditchtheform.com')
  })

  it('rejects another tenant and arbitrary external origins', () => {
    expect(tenantOwnedExtraOrigin('https://other-client.ditchtheform.com', tenantHosts)).toBeNull()
    expect(tenantOwnedExtraOrigin('https://attacker.example', tenantHosts)).toBeNull()
  })

  it('rejects non-http protocols and malformed values', () => {
    expect(tenantOwnedExtraOrigin('javascript:alert(1)', tenantHosts)).toBeNull()
    expect(tenantOwnedExtraOrigin('not a URL', tenantHosts)).toBeNull()
  })
})
