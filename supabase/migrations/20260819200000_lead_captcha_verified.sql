-- Rollout gate for requiring Turnstile on widget submissions.
--
-- TURNSTILE_REQUIRE_WIDGET cannot be turned on by guessing. Widget bundles
-- update themselves (the embed points at a stable loader, not a pinned hash),
-- but a site whose visitor loads a cached page, or where Cloudflare's script is
-- blocked, still submits without a token. Flipping the flag before that tail
-- reaches zero silently rejects real customers on the one form the whole
-- product exists to serve.
--
-- Recording whether each lead arrived with a verified token turns the decision
-- into a query: when 7 days of leads are all verified, it is safe to require.

alter table public.leads
  add column if not exists captcha_verified boolean;

comment on column public.leads.captcha_verified is
  'True when this submission carried a Turnstile token that verified, false when it carried none or one that failed, null for leads captured before the widget sent tokens. Rollout gate for TURNSTILE_REQUIRE_WIDGET — see src/lib/turnstileWidgetGuard.ts.';

create index if not exists leads_captcha_verified_idx
  on public.leads (created_at desc)
  where captcha_verified is not true;
