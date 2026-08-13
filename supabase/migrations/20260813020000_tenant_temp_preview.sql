-- Admin-granted temporary preview window. The public-site gate treats a future
-- timestamp as a narrow bypass of pending/payment gates without changing the
-- tenant's canonical site_status. The timestamp itself is checked at request
-- time, while the worker clears it after expiry for housekeeping.
alter table public.tenants
  add column if not exists temp_preview_expires_at timestamptz null;

comment on column public.tenants.temp_preview_expires_at is
  'Set by admin "Temporary Approve"; pending/payment gates are bypassed until this time. Null when no temporary override is in effect.';
