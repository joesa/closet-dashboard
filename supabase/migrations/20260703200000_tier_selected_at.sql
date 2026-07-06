-- Tracks whether the contractor has already made an explicit Standard vs AI
-- Premium tier decision BEFORE ever landing on the intake form UI (via the
-- /get-started?tier=... flow, or by clicking a tier-specific link in the
-- verification email). Used to hide the redundant "Choose your setup
-- package" TierPicker on the form when the choice was already made
-- elsewhere — showing it again after they already decided is confusing.
--
-- Deliberately NOT set by the in-form TierPicker itself (the
-- /api/intake/[token]/tier PATCH route) — if the contractor reaches that
-- point, TierPicker was correctly shown and used as intended.
ALTER TABLE prospect_intakes
ADD COLUMN IF NOT EXISTS tier_selected_at TIMESTAMPTZ;
