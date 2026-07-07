-- Update engagement_model check constraint for site_configs
ALTER TABLE site_configs DROP CONSTRAINT IF EXISTS site_configs_engagement_model_check;
ALTER TABLE site_configs ADD CONSTRAINT site_configs_engagement_model_check CHECK (engagement_model IN ('quote', 'order', 'booking', 'ticket'));


