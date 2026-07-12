-- Opt-in homepage lead quiz. Default false: sites only show a quiz when the
-- prospect explicitly enables it during intake (avoids identical AI funnel on every site).
ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS include_quiz boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prospect_intakes.include_quiz IS
  'When true, provision generates trade-specific quiz_config for the marketing site. When false, quiz_config is left null and the quiz section is omitted.';
