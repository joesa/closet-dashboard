import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { importLeadsToCampaign, startCampaign, upsertCampaignByName } from '@/lib/instantly'

export const runtime = 'nodejs'

type IncomingLead = {
  businessName?: string | null
  websiteUrl?: string | null
  sourceLocation?: string | null
  enrichment?: {
    primaryEmail?: string | null
    decisionMakerEmail?: string | null
    decisionMakerName?: string | null
    outreachRank?: string | null
    confidenceScore?: number | null
    reason?: string | null
    pipeline?: 'PIPELINE_A' | 'PIPELINE_B'
  }
}

type IncomingSequenceStep = {
  step: number
  waitDaysAfterPrevious: number
  subject: string
  body: string
}

type IncomingCampaign = {
  name: string
  sequenceKey: 'widget_cold_outreach' | 'website_agency_upsell'
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
  sequence: IncomingSequenceStep[]
}

type IncomingPayload = {
  runId: string
  idempotencyKey?: string
  pipeline: 'PIPELINE_A' | 'PIPELINE_B'
  batchIndex: number
  totalBatches: number
  count: number
  campaign: IncomingCampaign
  leads: IncomingLead[]
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = Number.parseInt(raw || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toHostname(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function splitName(name: string): { firstName: string; lastName: string } {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) return { firstName: '', lastName: '' }

  const parts = normalized.split(' ')
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function inferNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split('@')[0] || ''
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: capitalize(parts[0]),
      lastName: capitalize(parts[1]),
    }
  }
  if (parts.length === 1) {
    return {
      firstName: capitalize(parts[0]),
      lastName: '',
    }
  }
  return { firstName: '', lastName: '' }
}

function capitalize(value: string): string {
  if (!value) return ''
  return value[0].toUpperCase() + value.slice(1).toLowerCase()
}

function extractWebhookToken(req: Request): string {
  const auth = req.headers.get('authorization') || ''
  if (/^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, '').trim()
  }
  if (auth.trim()) return auth.trim()

  return (
    req.headers.get('x-webhook-token') ||
    req.headers.get('x-api-key') ||
    ''
  ).trim()
}

function isValidPayload(payload: any): payload is IncomingPayload {
  if (!payload || typeof payload !== 'object') return false
  if (typeof payload.runId !== 'string' || !payload.runId.trim()) return false
  if (payload.pipeline !== 'PIPELINE_A' && payload.pipeline !== 'PIPELINE_B') return false
  if (!Number.isFinite(payload.batchIndex) || !Number.isFinite(payload.totalBatches)) return false
  if (!Array.isArray(payload.leads)) return false
  if (!payload.campaign || typeof payload.campaign.name !== 'string') return false
  if (!Array.isArray(payload.campaign.sequence)) return false
  return true
}

function toLeadImportRows(payload: IncomingPayload) {
  const dedup = new Set<string>()
  const rows: Array<{
    email: string
    firstName: string
    lastName: string
    companyName: string
    website: string
    customVariables: Record<string, string>
  }> = []

  for (const lead of payload.leads) {
    const preferredEmail =
      (lead.enrichment?.decisionMakerEmail || lead.enrichment?.primaryEmail || '')
        .trim()
        .toLowerCase()

    if (!preferredEmail) continue
    if (dedup.has(preferredEmail)) continue
    dedup.add(preferredEmail)

    const decisionMakerName = (lead.enrichment?.decisionMakerName || '').trim()
    const fromName = decisionMakerName ? splitName(decisionMakerName) : inferNameFromEmail(preferredEmail)

    rows.push({
      email: preferredEmail,
      firstName: fromName.firstName,
      lastName: fromName.lastName,
      companyName: (lead.businessName || '').trim(),
      website: payload.pipeline === 'PIPELINE_A' ? toHostname(lead.websiteUrl) : '',
      customVariables: {
        pipeline: payload.pipeline,
        runId: payload.runId,
        sourceLocation: (lead.sourceLocation || '').trim(),
        outreachRank: String(lead.enrichment?.outreachRank || ''),
        reason: String(lead.enrichment?.reason || ''),
        confidenceScore: String(lead.enrichment?.confidenceScore ?? ''),
      },
    })
  }

  return rows
}

async function insertSyncEvent(payload: IncomingPayload, eventKey: string): Promise<'inserted' | 'duplicate'> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('instantly_sync_events').insert({
    event_key: eventKey,
    run_id: payload.runId,
    pipeline: payload.pipeline,
    batch_index: payload.batchIndex,
    total_batches: payload.totalBatches,
    status: 'pending',
    payload,
  })

  if (!error) return 'inserted'

  if (error.code === '23505') return 'duplicate'
  throw new Error(`Failed to insert sync event: ${error.message}`)
}

async function updateSyncEvent(eventKey: string, patch: Record<string, unknown>): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('instantly_sync_events')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('event_key', eventKey)

  if (error) {
    throw new Error(`Failed to update sync event: ${error.message}`)
  }
}

export async function POST(req: Request) {
  try {
    const receiverToken = process.env.INSTANTLY_RECEIVER_AUTH_TOKEN
    if (!receiverToken) {
      return NextResponse.json(
        { error: 'INSTANTLY_RECEIVER_AUTH_TOKEN is not configured' },
        { status: 500 }
      )
    }

    const incomingToken = extractWebhookToken(req)
    if (!incomingToken || incomingToken !== receiverToken) {
      return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 })
    }

    const payload = await req.json()
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const eventKey = payload.idempotencyKey || `${payload.runId}:${payload.pipeline}:${payload.batchIndex}`
    const insertState = await insertSyncEvent(payload, eventKey)
    if (insertState === 'duplicate') {
      return NextResponse.json({ ok: true, duplicate: true, eventKey }, { status: 200 })
    }

    const minLeadsPerBatch = parseIntEnv('INSTANTLY_MIN_LEADS_PER_BATCH', 1)
    const autoStartEnabled = process.env.INSTANTLY_AUTO_START === 'true'
    const warmupMode = process.env.INSTANTLY_WARMUP_MODE !== 'false'

    const leadRows = toLeadImportRows(payload)

    if (leadRows.length < minLeadsPerBatch) {
      await updateSyncEvent(eventKey, {
        status: 'skipped_threshold',
        result: {
          importedLeads: 0,
          dedupedLeads: leadRows.length,
          minLeadsPerBatch,
        },
      })

      return NextResponse.json(
        {
          ok: true,
          skipped: 'below_min_lead_threshold',
          dedupedLeads: leadRows.length,
          minLeadsPerBatch,
        },
        { status: 200 }
      )
    }

    const upsert = await upsertCampaignByName(payload.campaign)
    await importLeadsToCampaign(upsert.campaignId, leadRows)

    const shouldStart = autoStartEnabled && !warmupMode
    if (shouldStart) {
      await startCampaign(upsert.campaignId)
    }

    await updateSyncEvent(eventKey, {
      status: 'synced',
      result: {
        campaignId: upsert.campaignId,
        campaignCreated: upsert.created,
        importedLeads: leadRows.length,
        autoStartEnabled,
        warmupMode,
        campaignStarted: shouldStart,
      },
    })

    return NextResponse.json(
      {
        ok: true,
        eventKey,
        campaignId: upsert.campaignId,
        campaignCreated: upsert.created,
        importedLeads: leadRows.length,
        campaignStarted: shouldStart,
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
