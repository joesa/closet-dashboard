/**
 * Install detection for the embedded widget.
 *
 * The only evidence we get that a contractor actually pasted the snippet is a
 * `GET /api/settings` arriving with their id and an `Origin` that is not ours.
 * That answers two questions that had none: did this ever go live, and on which
 * host — the first is what a contractor wants to see in their dashboard, the
 * second is what an origin allowlist would have to be built from.
 *
 * Recording only. Nothing here rejects a request, and nothing here is allowed
 * to affect the response: the first version of this module read its state from
 * the settings query, which meant adding two ungranted columns to that query
 * and failing it outright for `anon` — every embedded widget got a 500 and fell
 * back to stock closet pricing. Telemetry does not belong on the render path,
 * so this now does its own write with the service role and swallows everything.
 */

import { createClient } from '@supabase/supabase-js'

/** Hosts that are us, not a customer's website. */
const PLATFORM_HOST_RE =
  /(^|\.)(ditchtheform\.com|closetquotes\.com|vercel\.app)$|^localhost$|^127\.0\.0\.1$/i

export function isPlatformOrigin(origin: string | null): boolean {
  if (!origin) return true
  try {
    return PLATFORM_HOST_RE.test(new URL(origin).hostname)
  } catch {
    return true
  }
}

/**
 * Record the install idempotently, in one statement.
 *
 * The filter carries the idempotence: the row is only touched when the origin
 * actually changed or the install has never been stamped, so a repeat page view
 * costs one indexed no-op rather than a write. `widget_installed_at` keeps its
 * original value once set.
 */
export async function recordWidgetInstall(opts: {
  contractorId: string
  origin: string | null
}): Promise<void> {
  const { contractorId, origin } = opts
  if (isPlatformOrigin(origin)) return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const now = new Date().toISOString()

    const { data: existing } = await admin
      .from('contractor_settings')
      .select('widget_installed_at, widget_last_seen_origin')
      .eq('id', contractorId)
      .maybeSingle()

    const installedAt = (existing as { widget_installed_at?: string | null } | null)
      ?.widget_installed_at ?? null
    const lastSeenOrigin = (existing as { widget_last_seen_origin?: string | null } | null)
      ?.widget_last_seen_origin ?? null
    if (installedAt && lastSeenOrigin === origin) return

    const patch: Record<string, unknown> = {
      widget_last_seen_origin: origin,
      widget_last_seen_at: now,
    }
    if (!installedAt) patch.widget_installed_at = now

    await admin.from('contractor_settings').update(patch).eq('id', contractorId)
  } catch (err) {
    // Never surfaces. A telemetry failure must not touch the widget.
    console.warn('[widget-install] record skipped', contractorId, err)
  }
}
