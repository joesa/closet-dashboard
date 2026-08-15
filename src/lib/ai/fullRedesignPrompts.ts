import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { RecordedPrompt } from '@/lib/ai/promptRecorder'

/**
 * Persistence for the prompts behind the current draft.
 *
 * One row per tenant, replaced on each run: this answers "what produced the
 * site I am looking at", not "what has ever been tried". Writes are
 * best-effort — a redesign that generated a site must not be reported as
 * failed because its audit trail did not save.
 *
 * Server-only.
 */

export type FullRedesignPromptRecord = {
  tenantId: string
  runId: string | null
  brandName: string | null
  startedAt: string | null
  prompts: RecordedPrompt[]
}

export async function saveFullRedesignPrompts(input: {
  tenantId: string
  runId?: string | null
  brandName?: string | null
  prompts: RecordedPrompt[]
}): Promise<void> {
  if (!input.prompts.length) return
  try {
    const { error } = await getSupabaseAdmin()
      .from('full_redesign_prompts')
      .upsert(
        {
          tenant_id: input.tenantId,
          run_id: input.runId ?? null,
          brand_name: input.brandName ?? null,
          started_at: input.prompts[0]?.at ?? new Date().toISOString(),
          prompts: input.prompts,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
    if (error) throw error
  } catch (err) {
    console.warn(
      `[fullRedesignPrompts] could not save prompts for ${input.tenantId}:`,
      err instanceof Error ? err.message : err
    )
  }
}

export async function loadFullRedesignPrompts(
  tenantId: string
): Promise<FullRedesignPromptRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('full_redesign_prompts')
    .select('tenant_id, run_id, brand_name, started_at, prompts')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) return null
  return {
    tenantId: data.tenant_id as string,
    runId: (data.run_id as string | null) ?? null,
    brandName: (data.brand_name as string | null) ?? null,
    startedAt: (data.started_at as string | null) ?? null,
    prompts: Array.isArray(data.prompts) ? (data.prompts as RecordedPrompt[]) : [],
  }
}
