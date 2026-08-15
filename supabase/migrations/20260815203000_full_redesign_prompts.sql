-- =============================================================================
-- full_redesign_prompts — the exact model inputs behind a finished redesign.
-- =============================================================================
-- The job row keeps the reply and the warnings, but the prompts that actually
-- produced the site (system prompt, the locked brief, every page's user prompt,
-- anything a guard repair sent) only ever existed in worker stdout, which
-- rotates away in days. That makes "why did it build this?" unanswerable after
-- the fact, and makes prompt changes impossible to A/B against real output.
--
-- One row per run, superseded on rerun: this is a record of what produced the
-- CURRENT draft, not an archive of every attempt. Keeping it separate from
-- site_configs keeps a ~100KB payload out of a row that is read on every page
-- render.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.full_redesign_prompts (
    tenant_id   uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Matches custom_build_job.started_at so a prompt set can be tied to the
    -- run that is on screen, and a stale set is recognisable as stale.
    run_id      text,
    brand_name  text,
    started_at  timestamptz,
    -- [{pass, provider, model, endpoint, systemPrompt, userPrompt, imageCount,
    --   durationMs, ok, at}] in call order. Individual prompts are clamped in
    --   src/lib/ai/promptRecorder.ts before they get here.
    prompts     jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT full_redesign_prompts_is_array CHECK (jsonb_typeof(prompts) = 'array')
);

COMMENT ON TABLE public.full_redesign_prompts IS
    'Exact model inputs for the most recent Full redesign of each tenant, shown collapsed on the admin site page.';

ALTER TABLE public.full_redesign_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "full_redesign_prompts_service_role" ON public.full_redesign_prompts;
CREATE POLICY "full_redesign_prompts_service_role"
    ON public.full_redesign_prompts FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "full_redesign_prompts_admin_read" ON public.full_redesign_prompts;
CREATE POLICY "full_redesign_prompts_admin_read"
    ON public.full_redesign_prompts FOR SELECT
    USING (public.is_admin());
