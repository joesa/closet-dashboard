-- =============================================================================
-- ai_providers / ai_purpose_assignments — admin-configurable model routing.
-- =============================================================================
-- Every AI decision used to be a hardcoded chain in aiTextProvider.ts plus an
-- env var, so changing which model writes customer-facing copy meant a code
-- edit, a push, CI, and a VM worker rebuild. These two tables move that choice
-- to an admin screen.
--
-- Precedence is deliberate: an enabled assignment row overrides the code
-- default, and anything unset falls back to the existing env/constant chain.
-- With both tables empty the application behaves exactly as it did before, so
-- this can ship dark and be adopted one purpose at a time.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_ai_providers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stable handle referenced by assignment chains. Renaming a label must not
    -- silently repoint every purpose, so the slug is what chains store.
    slug                text NOT NULL UNIQUE,
    label               text NOT NULL,
    -- Wire protocol, not vendor. Ollama, LM Studio and Unsloth/vLLM all speak
    -- the OpenAI format, so they share 'openai_compatible' and differ only by
    -- base_url — no per-runtime adapter needed.
    kind                text NOT NULL CHECK (kind IN ('anthropic', 'openai', 'gemini', 'openai_compatible')),
    -- NULL means the SDK default endpoint. Required in practice for local
    -- runtimes, which must be reachable from BOTH Vercel and the worker VM —
    -- a localhost URL works from neither.
    base_url            text,
    -- AES-256-GCM from src/lib/crypto/secretBox.ts. Never the plaintext key.
    api_key_encrypted   text,
    -- Masked tail so the UI can show which key is stored.
    api_key_hint        text,
    extra_headers       jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled             boolean NOT NULL DEFAULT true,
    -- Result of the admin "Test" action. Local endpoints fail far more often
    -- than hosted ones; without this the screen is a guessing game.
    last_checked_at     timestamptz,
    last_check_ok       boolean,
    last_check_error    text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_ai_providers IS
    'Text/image model endpoints an admin can route work to: hosted vendors and OpenAI-compatible local runtimes.';
COMMENT ON COLUMN public.platform_ai_providers.base_url IS
    'Override endpoint. Local runtimes need a URL reachable from Vercel AND the worker VM (tunnel or public host), never localhost.';
COMMENT ON COLUMN public.platform_ai_providers.api_key_encrypted IS
    'AES-256-GCM ciphertext under AI_CONFIG_KEY. Decryption failures disable the provider rather than throwing into a generation path.';

CREATE TABLE IF NOT EXISTS public.platform_ai_purpose_assignments (
    -- Matches a key in src/lib/ai/purposes.ts. Free text rather than an enum so
    -- adding a purpose is a code change, not a migration; unknown keys are
    -- ignored at resolution time.
    purpose      text PRIMARY KEY,
    -- Ordered fallback chain:
    --   [{"provider_slug": "ollama-gpu", "model": "llama3.1:70b"}, ...]
    chain        jsonb NOT NULL DEFAULT '[]'::jsonb,
    enabled      boolean NOT NULL DEFAULT true,
    updated_by   uuid,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_ai_purpose_assignments_chain_is_array CHECK (jsonb_typeof(chain) = 'array')
);

COMMENT ON TABLE public.platform_ai_purpose_assignments IS
    'Which provider+model chain serves each named AI purpose. Absent or disabled rows fall back to the code/env default.';

-- Lets a write bump a marker that resolution caches poll, so an admin change
-- takes effect within one cache TTL instead of waiting one out on every
-- long-lived worker process.
CREATE TABLE IF NOT EXISTS public.platform_ai_config_version (
    id           boolean PRIMARY KEY DEFAULT true CHECK (id),
    version      bigint NOT NULL DEFAULT 1,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_ai_config_version (id, version)
VALUES (true, 1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_platform_ai_config_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.platform_ai_config_version
       SET version = version + 1, updated_at = now()
     WHERE id = true;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_ai_providers_bump_version ON public.platform_ai_providers;
CREATE TRIGGER trg_platform_ai_providers_bump_version
    AFTER INSERT OR UPDATE OR DELETE ON public.platform_ai_providers
    FOR EACH STATEMENT EXECUTE FUNCTION public.bump_platform_ai_config_version();

DROP TRIGGER IF EXISTS trg_platform_ai_purpose_assignments_bump_version ON public.platform_ai_purpose_assignments;
CREATE TRIGGER trg_platform_ai_purpose_assignments_bump_version
    AFTER INSERT OR UPDATE OR DELETE ON public.platform_ai_purpose_assignments
    FOR EACH STATEMENT EXECUTE FUNCTION public.bump_platform_ai_config_version();

-- -----------------------------------------------------------------------------
-- RLS: service role does everything; admins may read. Writes go through server
-- actions on the service-role client, never straight from a browser session.
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_purpose_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_config_version ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_ai_providers_service_role" ON public.platform_ai_providers;
CREATE POLICY "platform_ai_providers_service_role"
    ON public.platform_ai_providers FOR ALL
    USING (auth.role() = 'service_role');

-- Admins read metadata only in practice: api_key_encrypted is useless without
-- AI_CONFIG_KEY, which never leaves the server environment.
DROP POLICY IF EXISTS "platform_ai_providers_admin_read" ON public.platform_ai_providers;
CREATE POLICY "platform_ai_providers_admin_read"
    ON public.platform_ai_providers FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "platform_ai_purpose_assignments_service_role" ON public.platform_ai_purpose_assignments;
CREATE POLICY "platform_ai_purpose_assignments_service_role"
    ON public.platform_ai_purpose_assignments FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_ai_purpose_assignments_admin_read" ON public.platform_ai_purpose_assignments;
CREATE POLICY "platform_ai_purpose_assignments_admin_read"
    ON public.platform_ai_purpose_assignments FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "platform_ai_config_version_service_role" ON public.platform_ai_config_version;
CREATE POLICY "platform_ai_config_version_service_role"
    ON public.platform_ai_config_version FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_ai_config_version_admin_read" ON public.platform_ai_config_version;
CREATE POLICY "platform_ai_config_version_admin_read"
    ON public.platform_ai_config_version FOR SELECT
    USING (public.is_admin());
