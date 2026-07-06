-- before_after_config is NOT NULL DEFAULT '{}'::jsonb (see
-- 20260528145700_add_before_after.sql), but with the new 'not-applicable'
-- BeforeAfterCategory (see openai-images.ts), provisionTenant.ts now
-- deliberately omits this config entirely for businesses with no physical
-- "before" state (restaurants, legal services, etc.) by setting it to null.
-- Allow that.
ALTER TABLE site_configs
  ALTER COLUMN before_after_config DROP NOT NULL;
