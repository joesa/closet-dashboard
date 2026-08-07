import { describe, expect, it } from 'vitest'
import { chooseOwnedTenantId } from './auth'

const tenants = [
  { id: 'tenant-new', widget_id: 'settings-new', site_status: 'widget_only' },
  { id: 'tenant-raw-tree', widget_id: 'settings-old', site_status: 'active' },
]

describe('chooseOwnedTenantId', () => {
  it('continues past the newest widget-only profile to an older hosted site', () => {
    expect(
      chooseOwnedTenantId(['settings-new', 'settings-old'], tenants, [])
    ).toBe('tenant-raw-tree')
  })

  it('selects the owned tenant matching the current hostname for multi-site accounts', () => {
    const multipleHosted = [
      { id: 'tenant-new', widget_id: 'settings-new', site_status: 'active' },
      tenants[1],
    ]
    expect(
      chooseOwnedTenantId(
        ['settings-new', 'settings-old'],
        multipleHosted,
        [
          { tenant_id: 'tenant-new', hostname: 'new-site.ditchtheform.com' },
          { tenant_id: 'tenant-raw-tree', hostname: 'raw-tree-services.ditchtheform.com' },
        ],
        'RAW-TREE-SERVICES.DITCHTHEFORM.COM'
      )
    ).toBe('tenant-raw-tree')
  })

  it('does not select a hostname that is not attached to an owned hosted tenant', () => {
    expect(
      chooseOwnedTenantId(
        ['settings-new', 'settings-old'],
        tenants,
        [{ tenant_id: 'another-tenant', hostname: 'raw-tree-services.ditchtheform.com' }],
        'raw-tree-services.ditchtheform.com'
      )
    ).toBe('tenant-raw-tree')
  })
})
