import { getSupabaseAdmin } from '@/lib/supabase-admin'

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function checkAndIncrementAiUsage(
  kind: 'generate_site' | 'generate_images'
): Promise<{ allowed: boolean; reason?: string }> {
  if (process.env.AUTO_PROVISION_AI_ENABLED === '1') {
    // Still cap manual/admin AI separately
  }

  const max = parseInt(process.env.AI_GENERATE_DAILY_MAX || '50', 10)
  if (!Number.isFinite(max) || max <= 0) {
    return { allowed: true }
  }

  const admin = getSupabaseAdmin()
  const date = todayUtc()
  const col =
    kind === 'generate_site' ? 'generate_site_count' : 'generate_images_count'

  const { data: row } = await admin
    .from('ai_usage_daily')
    .select('generate_site_count, generate_images_count')
    .eq('usage_date', date)
    .maybeSingle()

  const current = (row?.[col as keyof typeof row] as number) ?? 0
  if (current >= max) {
    return { allowed: false, reason: `Daily AI limit reached (${max})` }
  }

  const siteCount =
    (row?.generate_site_count ?? 0) + (kind === 'generate_site' ? 1 : 0)
  const imgCount =
    (row?.generate_images_count ?? 0) + (kind === 'generate_images' ? 1 : 0)

  await admin.from('ai_usage_daily').upsert(
    {
      usage_date: date,
      generate_site_count: siteCount,
      generate_images_count: imgCount,
    },
    { onConflict: 'usage_date' }
  )

  return { allowed: true }
}
