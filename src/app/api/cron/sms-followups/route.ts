import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  isPhoneSuppressed,
  sendSms,
  personalizeTemplate,
  PIPELINE_B_SMS_TEMPLATES,
  countSmsSentToday,
  isWithinSmsSendWindow,
} from '@/lib/twilio-sms'

export const runtime = 'nodejs'

const STEP2_DELAY_DAYS = Number.parseInt(process.env.SMS_STEP2_DELAY_DAYS || '2', 10) || 2

/**
 * Hourly cron: send SMS step-2 follow-ups for step-1 messages that are old enough,
 * not suppressed, and have no step-2 yet.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isWithinSmsSendWindow()) {
    return NextResponse.json({ ok: true, skipped: 'outside_send_window' })
  }

  const maxDaily = Number.parseInt(process.env.SMS_MAX_DAILY || '50', 10) || 50
  let sentToday = await countSmsSentToday()
  if (sentToday >= maxDaily) {
    return NextResponse.json({ ok: true, skipped: 'daily_cap', sentToday, maxDaily })
  }

  const admin = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - STEP2_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('sms_outreach_events')
    .select('id, event_key, run_id, phone_number, business_name, source_location, created_at')
    .eq('message_step', 1)
    .eq('status', 'sent')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const template =
    PIPELINE_B_SMS_TEMPLATES.find((t) => t.step === 2) || PIPELINE_B_SMS_TEMPLATES[1]

  let sent = 0
  let skippedSuppressed = 0
  let skippedDuplicate = 0
  let skippedCap = 0
  let failed = 0

  for (const row of candidates || []) {
    if (sentToday >= maxDaily) {
      skippedCap++
      continue
    }

    const phone = row.phone_number
    if (!phone) continue

    if (await isPhoneSuppressed(phone)) {
      skippedSuppressed++
      continue
    }

    const eventKey = `${row.run_id}:sms:${phone}:step2`
    const city = (row.source_location || '').split(',')[0]?.trim() || 'your area'
    const messageBody = personalizeTemplate(template.body, {
      businessName: (row.business_name || 'your business').trim(),
      city,
    })

    const { error: insertError } = await admin.from('sms_outreach_events').insert({
      event_key: eventKey,
      run_id: row.run_id,
      phone_number: phone,
      business_name: row.business_name,
      source_location: row.source_location,
      message_step: 2,
      message_body: messageBody,
      status: 'pending',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        skippedDuplicate++
        continue
      }
      failed++
      continue
    }

    const result = await sendSms(phone, messageBody)
    if (result.success) {
      await admin
        .from('sms_outreach_events')
        .update({
          status: 'sent',
          twilio_message_sid: result.messageSid,
          updated_at: new Date().toISOString(),
        })
        .eq('event_key', eventKey)
      sent++
      sentToday++
    } else {
      await admin
        .from('sms_outreach_events')
        .update({
          status: 'failed',
          error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('event_key', eventKey)
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: (candidates || []).length,
    sent,
    skippedSuppressed,
    skippedDuplicate,
    skippedCap,
    failed,
    sentToday,
    maxDaily,
  })
}
