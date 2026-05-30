-- Simple per-key rate limiting for public widget APIs (service role writes only).
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    count INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON public.api_rate_limits(window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_rate_limits_service_role" ON public.api_rate_limits;
CREATE POLICY "api_rate_limits_service_role"
    ON public.api_rate_limits FOR ALL
    USING (auth.role() = 'service_role');
