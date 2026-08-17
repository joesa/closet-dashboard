/**
 * Install detection for the embedded widget.
 *
 * The only evidence we get that a contractor actually pasted the snippet is a
 * `GET /api/settings` arriving with their id and an `Origin` that is not ours.
 * That is enough to answer the two questions that had no answer before: did
 * this ever go live, and on which host — the first is what a contractor wants
 * to see in their dashboard, the second is what an origin allowlist would have
 * to be built from.
 *
 * Recording only. Nothing here rejects a request: enforcement before we know
 * the real distribution of hosts (apex vs www, staging, builders that proxy)
 * would break working calculators for people who did nothing wrong.
 */

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

type UpdatableClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>
    }
  }
}

/**
 * Record the install, cheaply and idempotently.
 *
 * Called on the widget's settings fetch, which is on the render path for every
 * page view of every embed — so it writes only when something changed: the
 * first sighting, or an origin different from the one already stored. A
 * same-origin repeat view costs one comparison and no write.
 */
export async function recordWidgetInstall(opts: {
  /** Any Supabase-shaped client. Structural so the edge route can pass its own. */
  supabase: UpdatableClient
  contractorId: string
  origin: string | null
  installedAt: string | null
  lastSeenOrigin: string | null
}): Promise<void> {
  const { supabase, contractorId, origin, installedAt, lastSeenOrigin } = opts
  if (isPlatformOrigin(origin)) return
  if (installedAt && lastSeenOrigin === origin) return

  const patch: Record<string, unknown> = {
    widget_last_seen_origin: origin,
    widget_last_seen_at: new Date().toISOString(),
  }
  if (!installedAt) patch.widget_installed_at = new Date().toISOString()

  const { error } = await supabase
    .from('contractor_settings')
    .update(patch)
    .eq('id', contractorId)
  if (error) {
    // Telemetry must never break the widget it is measuring.
    console.warn('[widget-install] record failed', contractorId, error)
  }
}
