import { qualifyLeadForSpecBuild, type ScrapedLeadShape } from '@/lib/spec/qualifyLead'
import {
  countSpecBuildsStartedToday,
  queueSpecBuild,
  specBuildDailyMax,
  specBuildsEnabled,
} from '@/lib/spec/specBuilds'

export type EnqueueFromRunSummary = {
  enabled: boolean
  considered: number
  queued: number
  duplicates: number
  unqualified: number
  capped: number
  budgetRemaining: number
}

/**
 * Queue spec builds for the qualifying leads of a finished scraper run.
 *
 * Deliberately conservative on two axes, because this is the one place where a
 * single crawl could otherwise start hundreds of paid AI builds unattended:
 *
 *  - It is off unless SPEC_BUILD_ENABLED is explicitly 'true'.
 *  - It never exceeds the remaining SPEC_BUILD_DAILY_MAX budget for the UTC
 *    day, counting builds already created rather than ones that succeeded —
 *    a failed build still spent money getting where it failed.
 *
 * Leads beyond the budget are simply not queued. They are not lost: the same
 * business will reappear on the next crawl of that city, and an admin can
 * always queue one by hand.
 */
/**
 * Decide which leads to attempt, given a budget. Pure, so the spend ceiling is
 * testable without a database — this is the check that stands between one
 * crawl and hundreds of paid builds.
 *
 * Unqualified leads never consume budget: rejecting a lead costs nothing, so
 * spending a slot on one would silently shrink the day's real capacity.
 */
export type ScraperLeadPair = {
  id: string
  row: ScrapedLeadShape
  /** Not a column on scraper_leads — carried through from the raw scraped lead. */
  mapsPlaceUrl?: string | null
}

export function planSpecBuildEnqueue(
  leads: ScraperLeadPair[],
  budget: number
): {
  toQueue: { id: string; lead: ReturnType<typeof qualifyLeadForSpecBuild>; mapsPlaceUrl?: string | null }[]
  unqualified: number
  capped: number
} {
  let remaining = Math.max(0, budget)
  const toQueue: {
    id: string
    lead: ReturnType<typeof qualifyLeadForSpecBuild>
    mapsPlaceUrl?: string | null
  }[] = []
  let unqualified = 0
  let capped = 0

  for (const lead of leads) {
    const qualified = qualifyLeadForSpecBuild(lead.row)
    if (!qualified.qualified) {
      unqualified += 1
      continue
    }
    if (remaining <= 0) {
      capped += 1
      continue
    }
    remaining -= 1
    toQueue.push({ id: lead.id, lead: qualified, mapsPlaceUrl: lead.mapsPlaceUrl })
  }

  return { toQueue, unqualified, capped }
}

export async function enqueueSpecBuildsForRun(
  runId: string,
  leads: ScraperLeadPair[]
): Promise<EnqueueFromRunSummary> {
  const summary: EnqueueFromRunSummary = {
    enabled: specBuildsEnabled(),
    considered: leads.length,
    queued: 0,
    duplicates: 0,
    unqualified: 0,
    capped: 0,
    budgetRemaining: 0,
  }
  if (!summary.enabled) return summary

  const startedToday = await countSpecBuildsStartedToday()
  const budget = Math.max(0, specBuildDailyMax() - startedToday)

  const plan = planSpecBuildEnqueue(leads, budget)
  summary.unqualified = plan.unqualified
  summary.capped = plan.capped

  for (const item of plan.toQueue) {
    if (!item.lead.qualified) continue
    try {
      const result = await queueSpecBuild({
        lead: { ...item.lead.lead, mapsPlaceUrl: item.mapsPlaceUrl ?? null },
        leadSource: 'scraper',
        scraperLeadId: item.id,
        scraperRunId: runId,
      })
      if (result.queued) summary.queued += 1
      else if (result.reason === 'duplicate') summary.duplicates += 1
      else summary.unqualified += 1
    } catch (err) {
      // A queueing failure must never fail the scraper's run-status webhook —
      // the run results are already saved and are the more valuable artifact.
      console.error('[spec-builds] failed to queue lead', item.id, err)
      summary.unqualified += 1
    }
  }

  summary.budgetRemaining = Math.max(0, budget - summary.queued)
  return summary
}
