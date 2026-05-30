type InstantlyRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

type CampaignStep = {
  step: number
  waitDaysAfterPrevious: number
  subject: string
  body: string
}

type CampaignBlueprint = {
  name: string
  sequenceKey: string
  followUpDelayDays: number
  schedule: {
    timezone: string
    days: string[]
    startHour: number
    endHour: number
  }
  safety: {
    maxDailyPerAccount: number
    minDelaySeconds: number
    maxDelaySeconds: number
  }
  sequence: CampaignStep[]
}

type LeadImportRow = {
  email: string
  firstName: string
  lastName: string
  companyName: string
  website: string
  customVariables: Record<string, string>
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function getApiConfig() {
  const baseUrl = process.env.INSTANTLY_API_BASE_URL || 'https://api.instantly.ai/api/v2'
  const apiKey = requiredEnv('INSTANTLY_API_KEY')
  const authHeader = process.env.INSTANTLY_API_AUTH_HEADER || 'Authorization'
  const authPrefix = process.env.INSTANTLY_API_AUTH_PREFIX || 'Bearer'

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    authHeader,
    authValue: authPrefix ? `${authPrefix} ${apiKey}` : apiKey,
  }
}

function isTemplatedCampaignPath(path: string): boolean {
  return path.includes('{campaignId}')
}

function applyPathTemplate(template: string, campaignId: string): string {
  return template.replace('{campaignId}', campaignId)
}

async function instantlyRequest(path: string, options?: InstantlyRequestOptions): Promise<unknown> {
  const cfg = getApiConfig()
  const method = options?.method || 'GET'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [cfg.authHeader]: cfg.authValue,
  }

  const response = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const raw = await response.text()
  const payload = raw ? safeJson(raw) : null

  if (!response.ok) {
    const errText = payload ? JSON.stringify(payload) : raw
    throw new Error(`Instantly API ${method} ${path} failed (${response.status}): ${errText}`)
  }

  return payload
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const obj = value as Record<string, unknown> | null | undefined
  if (Array.isArray(obj?.items)) return obj.items
  if (Array.isArray(obj?.data)) return obj.data
  if (Array.isArray(obj?.campaigns)) return obj.campaigns
  return []
}

function campaignIdFromAny(item: unknown): string | null {
  const obj = item as Record<string, unknown> | null | undefined
  return String(obj?.id || obj?._id || obj?.campaign_id || '').trim() || null
}

export async function findCampaignByName(name: string): Promise<{ id: string; raw: unknown } | null> {
  const campaignsPath = process.env.INSTANTLY_CAMPAIGNS_PATH || '/campaigns'
  const searchParam = process.env.INSTANTLY_CAMPAIGN_SEARCH_QUERY_PARAM || 'search'
  const query = `${campaignsPath}?${encodeURIComponent(searchParam)}=${encodeURIComponent(name)}`

  const payload = await instantlyRequest(query)
  const items = asArray(payload)

  const match = items.find((item) => {
    const obj = item as Record<string, unknown> | null | undefined
    const candidate = String(obj?.name || obj?.campaign_name || '').trim().toLowerCase()
    return candidate === name.trim().toLowerCase()
  })
  if (!match) return null

  const id = campaignIdFromAny(match)
  if (!id) return null
  return { id, raw: match }
}

function campaignPayloadFromBlueprint(blueprint: CampaignBlueprint): Record<string, unknown> {
  const daysMap: Record<string, boolean> = {
    '0': false,
    '1': false,
    '2': false,
    '3': false,
    '4': false,
    '5': false,
    '6': false,
  }

  for (const day of blueprint.schedule.days || []) {
    const key = day.trim().slice(0, 3).toLowerCase()
    if (key === 'sun') daysMap['0'] = true
    if (key === 'mon') daysMap['1'] = true
    if (key === 'tue') daysMap['2'] = true
    if (key === 'wed') daysMap['3'] = true
    if (key === 'thu') daysMap['4'] = true
    if (key === 'fri') daysMap['5'] = true
    if (key === 'sat') daysMap['6'] = true
  }

  const pad = (n: number) => String(Math.max(0, Math.min(23, n))).padStart(2, '0')
  const fromHour = pad(blueprint.schedule.startHour)
  const toHour = pad(blueprint.schedule.endHour)

  return {
    name: blueprint.name,
    daily_limit: blueprint.safety.maxDailyPerAccount,
    random_wait_max: Math.ceil(blueprint.safety.maxDelaySeconds / 60),
    campaign_schedule: {
      schedules: [
        {
          name: 'Default Schedule',
          timing: {
            from: `${fromHour}:00`,
            to: `${toHour}:00`,
          },
          days: daysMap,
          timezone: blueprint.schedule.timezone,
        },
      ],
    },
    sequences: [
      {
        steps: blueprint.sequence
          .slice()
          .sort((a, b) => a.step - b.step)
          .map((step) => ({
            type: 'email',
            delay: Math.max(0, step.waitDaysAfterPrevious),
            delay_unit: 'days',
            variants: [
              {
                subject: step.subject,
                body: step.body,
              },
            ],
          })),
      },
    ],
  }
}

export async function upsertCampaignByName(blueprint: CampaignBlueprint): Promise<{ campaignId: string; created: boolean }> {
  const campaignsPath = process.env.INSTANTLY_CAMPAIGNS_PATH || '/campaigns'
  const existing = await findCampaignByName(blueprint.name)

  if (!existing) {
    const payload = campaignPayloadFromBlueprint(blueprint)
    const created = await instantlyRequest(campaignsPath, {
      method: 'POST',
      body: payload,
    })
    const campaignId = campaignIdFromAny((created as { data?: unknown })?.data || created)
    if (!campaignId) throw new Error('Instantly create campaign succeeded but returned no campaign id')
    return { campaignId, created: true }
  }

  const updatePathTemplate = process.env.INSTANTLY_UPDATE_CAMPAIGN_PATH || '/campaigns/{campaignId}'
  await instantlyRequest(applyPathTemplate(updatePathTemplate, existing.id), {
    method: 'PATCH',
    body: campaignPayloadFromBlueprint(blueprint),
  })

  return { campaignId: existing.id, created: false }
}

export async function importLeadsToCampaign(campaignId: string, leads: LeadImportRow[]): Promise<void> {
  const importPath = process.env.INSTANTLY_IMPORT_LEADS_PATH || '/leads/add'

  if (isTemplatedCampaignPath(importPath)) {
    // Backward-compatible path template support.
    const path = applyPathTemplate(importPath, campaignId)
    await instantlyRequest(path, {
      method: 'POST',
      body: {
        leads: leads.map((lead) => ({
          email: lead.email,
          first_name: lead.firstName,
          last_name: lead.lastName,
          company_name: lead.companyName,
          website: lead.website,
          custom_variables: lead.customVariables,
        })),
        skip_duplicates: true,
      },
    })
    return
  }

  // Instantly v2 documented import endpoint.
  await instantlyRequest(importPath, {
    method: 'POST',
    body: {
      campaign_id: campaignId,
      skip_if_in_workspace: true,
      leads: leads.map((lead) => ({
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company_name: lead.companyName,
        website: lead.website,
        custom_variables: lead.customVariables,
      })),
    },
  })
}

export async function startCampaign(campaignId: string): Promise<void> {
  const startPathTemplate = process.env.INSTANTLY_START_CAMPAIGN_PATH || '/campaigns/{campaignId}/activate'
  const path = applyPathTemplate(startPathTemplate, campaignId)
  await instantlyRequest(path, { method: 'POST', body: {} })
}
