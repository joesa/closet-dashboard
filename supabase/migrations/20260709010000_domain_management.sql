-- Extend domains for BYO + Vercel Registrar purchase lifecycle.
-- Platform subdomains stay as secondary hosts; custom/purchased become primary.

ALTER TABLE domains
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'platform_subdomain'
    CHECK (source IN ('platform_subdomain', 'byo', 'purchased')),
  ADD COLUMN IF NOT EXISTS vercel_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_records JSONB,
  ADD COLUMN IF NOT EXISTS nameservers TEXT[],
  ADD COLUMN IF NOT EXISTS registrar_order_id TEXT,
  ADD COLUMN IF NOT EXISTS purchase_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS purchase_currency TEXT NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_message TEXT;

-- Existing active hosts are treated as verified platform (or already-live) domains.
UPDATE domains
SET vercel_verified = true
WHERE ssl_status = 'active';

-- Pending custom hosts from intake provisioning are BYO.
UPDATE domains
SET source = 'byo'
WHERE ssl_status = 'pending'
  AND source = 'platform_subdomain';

CREATE INDEX IF NOT EXISTS idx_domains_ssl_pending
  ON domains (ssl_status)
  WHERE ssl_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_domains_tenant_primary
  ON domains (tenant_id, is_primary DESC);
