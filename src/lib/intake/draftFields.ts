// Sanitizes an intake draft-autosave body into a prospect_intakes column map.
// Mirrors the field mapping used by the submit route and generate-page-copy's
// opportunistic persistence, so a draft saved here hydrates the same form.

const MAX_TEXT = 4000
const MAX_SHORT = 300
const MAX_LIST = 40

function toStr(v: unknown, max = MAX_TEXT): string | undefined {
  if (typeof v !== 'string') return undefined
  return v.slice(0, max)
}

function toBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function toArr(v: unknown, maxItems = MAX_LIST): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.slice(0, MAX_SHORT))
    .slice(0, maxItems)
}

/** Accepts either a comma-separated string (form shape) or an array (submit shape). */
function toMaterials(v: unknown): string[] | undefined {
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_LIST)
  }
  return toArr(v)
}

function toPageContents(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (typeof value !== 'string') continue
    if (!/^[a-z0-9-]{1,60}$/.test(key)) continue
    out[key] = value.slice(0, 20000)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Builds the prospect_intakes update for a draft autosave. Only fields present
 * in the body (with the right type) are included, so partial saves never blank
 * out previously stored values.
 */
export function buildIntakeDraftUpdate(
  body: Record<string, unknown>
): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  const setIf = (column: string, value: unknown) => {
    if (value !== undefined) update[column] = value
  }

  setIf('business_name', toStr(body.businessName, MAX_SHORT))
  setIf('industry', toStr(body.industry, MAX_SHORT))
  setIf('contact_name', toStr(body.contactName, MAX_SHORT))
  setIf('contact_email', toStr(body.contactEmail, MAX_SHORT))
  setIf('contact_phone', toStr(body.contactPhone, MAX_SHORT))
  setIf('street_address', toStr(body.streetAddress, MAX_SHORT))
  setIf('address_locality', toStr(body.addressLocality, MAX_SHORT))
  setIf('address_region', toStr(body.addressRegion, MAX_SHORT))
  setIf('postal_code', toStr(body.postalCode, 20))
  setIf('service_area', toStr(body.serviceArea, MAX_SHORT))
  setIf('notification_email', toStr(body.notificationEmail, MAX_SHORT))
  setIf('notification_phone', toStr(body.notificationPhone, MAX_SHORT))
  setIf('services', toArr(body.services))
  setIf('other_services', toStr(body.otherServices))
  setIf('pricing_notes', toStr(body.pricingNotes))
  setIf('primary_color_hex', toStr(body.primaryColorHex, 20))
  setIf('vibe', toStr(body.vibe))
  setIf('tone', toStr(body.tone, MAX_SHORT))
  setIf('customers', toStr(body.customers))
  setIf('experience', toStr(body.experience))
  setIf('differentiators', toArr(body.differentiators))
  setIf('primary_cta', toStr(body.primaryCta, MAX_SHORT))
  setIf('desired_domain', toStr(body.desiredDomain, MAX_SHORT))
  setIf('domain_purchase_requested', toBool(body.domainPurchaseRequested))
  setIf('include_quiz', toBool(body.includeQuiz))
  setIf('notes', toStr(body.notes))
  setIf('requested_pages', toArr(body.pages))
  setIf('page_contents', toPageContents(body.pageContents))
  // Craft ("proprietary facts") answers — stored as text columns.
  setIf('craft_spec', toStr(body.craftSpec))
  setIf('shop_rule', toStr(body.shopRule))
  setIf('local_conditions', toStr(body.localConditions))
  setIf('crew_shape', toStr(body.crewShape))
  setIf('client_artifact', toStr(body.clientArtifact))
  setIf('recent_job', toStr(body.recentJob))
  setIf('competitor_tell', toStr(body.competitorTell))
  setIf('timeline_facts', toStr(body.timelineFacts))
  setIf('guarantee_terms', toStr(body.guaranteeTerms))
  setIf('signature_materials', toMaterials(body.signatureMaterials))
  // Verbatim customer quotes — only real quotes belong here, never invented.
  setIf('customer_quotes', toStr(body.customerQuotes))

  return update
}

/**
 * Rehydrates saved draft fields from a prospect_intakes row into the client
 * form shape (camelCase). Only non-empty values are included so the client's
 * defaults are never clobbered with blanks.
 */
export function buildServerDraftFromRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const draft: Record<string, unknown> = {}
  const str = (formKey: string, column: string) => {
    const v = row[column]
    if (typeof v === 'string' && v.trim()) draft[formKey] = v
  }
  const arr = (formKey: string, column: string) => {
    const v = row[column]
    if (Array.isArray(v) && v.length > 0) {
      draft[formKey] = v.filter((x): x is string => typeof x === 'string')
    }
  }
  const bool = (formKey: string, column: string) => {
    const v = row[column]
    if (typeof v === 'boolean') draft[formKey] = v
  }

  str('businessName', 'business_name')
  str('industry', 'industry')
  str('contactName', 'contact_name')
  str('contactEmail', 'contact_email')
  str('contactPhone', 'contact_phone')
  str('streetAddress', 'street_address')
  str('addressLocality', 'address_locality')
  str('addressRegion', 'address_region')
  str('postalCode', 'postal_code')
  str('serviceArea', 'service_area')
  str('notificationEmail', 'notification_email')
  str('notificationPhone', 'notification_phone')
  arr('services', 'services')
  str('otherServices', 'other_services')
  str('pricingNotes', 'pricing_notes')
  str('primaryColorHex', 'primary_color_hex')
  str('vibe', 'vibe')
  str('tone', 'tone')
  str('customers', 'customers')
  str('experience', 'experience')
  arr('differentiators', 'differentiators')
  str('primaryCta', 'primary_cta')
  str('desiredDomain', 'desired_domain')
  bool('domainPurchaseRequested', 'domain_purchase_requested')
  str('notes', 'notes')
  str('craftSpec', 'craft_spec')
  str('shopRule', 'shop_rule')
  str('localConditions', 'local_conditions')
  str('crewShape', 'crew_shape')
  str('clientArtifact', 'client_artifact')
  str('recentJob', 'recent_job')
  str('competitorTell', 'competitor_tell')
  str('timelineFacts', 'timeline_facts')
  str('guaranteeTerms', 'guarantee_terms')
  str('customerQuotes', 'customer_quotes')
  const materials = row.signature_materials
  if (Array.isArray(materials) && materials.length > 0) {
    draft.signatureMaterials = materials
      .filter((x): x is string => typeof x === 'string')
      .join(', ')
  }

  return draft
}
