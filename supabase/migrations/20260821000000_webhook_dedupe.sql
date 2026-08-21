-- Webhook deduplication table for preventing duplicate processing
CREATE TABLE IF NOT EXISTS webhook_dedupe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_webhook_dedupe_key_time
  ON webhook_dedupe (dedupe_key, created_at);

-- Cleanup function to remove old entries
CREATE OR REPLACE FUNCTION cleanup_webhook_dedupe(older_than_interval INTERVAL DEFAULT INTERVAL '5 minutes')
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_dedupe
  WHERE created_at < NOW() - older_than_interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup trigger (optional, can be called by cron)
-- SELECT cleanup_webhook_dedupe(INTERVAL '1 hour');

COMMENT ON TABLE webhook_dedupe IS 'Deduplication tracking for webhook processing';
COMMENT ON FUNCTION cleanup_webhook_dedupe IS 'Removes deduplication entries older than the specified interval';
