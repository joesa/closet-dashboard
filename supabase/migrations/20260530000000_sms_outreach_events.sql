-- Pipeline B SMS outreach tracking
-- Stores every SMS sent to no-website leads from the scraper

CREATE TABLE IF NOT EXISTS sms_outreach_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key TEXT UNIQUE NOT NULL,
  run_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  business_name TEXT,
  source_location TEXT,
  message_step INTEGER DEFAULT 1,
  message_body TEXT NOT NULL,
  twilio_message_sid TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_outreach_run_id ON sms_outreach_events(run_id);
CREATE INDEX IF NOT EXISTS idx_sms_outreach_phone ON sms_outreach_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_outreach_status ON sms_outreach_events(status);

-- Index for the follow-up cron: find step-1 messages ready for step-2
CREATE INDEX IF NOT EXISTS idx_sms_outreach_followup
  ON sms_outreach_events(message_step, status, created_at)
  WHERE message_step = 1 AND status = 'sent';
