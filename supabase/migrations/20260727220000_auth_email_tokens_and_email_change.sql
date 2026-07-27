-- Auth email tokens (password reset + email change via Resend)
CREATE TABLE IF NOT EXISTS public.auth_email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN (
      'password_verify',
      'password_reset',
      'email_change_confirm_old',
      'email_change_ack_old'
    )),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES public.contractor_settings(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_email_tokens_token_hash_uidx
  ON public.auth_email_tokens (token_hash);

CREATE INDEX IF NOT EXISTS auth_email_tokens_email_kind_idx
  ON public.auth_email_tokens (lower(email), kind, created_at DESC);

ALTER TABLE public.auth_email_tokens ENABLE ROW LEVEL SECURITY;
-- Service role only (no anon/authenticated policies)

-- Email change requests (admin-gated)
CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.contractor_settings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_email text NOT NULL,
  new_email text,
  status text NOT NULL DEFAULT 'awaiting_old_confirm'
    CHECK (status IN (
      'awaiting_old_confirm',
      'pending_admin',
      'approved',
      'rejected',
      'completed',
      'cancelled'
    )),
  old_confirmed_at timestamptz,
  admin_reviewed_at timestamptz,
  admin_actor_id uuid,
  activated_at timestamptz,
  old_acked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_change_requests_contractor_status_idx
  ON public.email_change_requests (contractor_id, status, created_at DESC);

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

-- Contractor ack flags after admin-approved email change
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS email_change_requires_old_ack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_change_previous_email text;

COMMENT ON COLUMN public.contractor_settings.email_change_requires_old_ack IS
  'After admin approves an email change, first login with the new email must be acked via the previous inbox.';
COMMENT ON COLUMN public.contractor_settings.email_change_previous_email IS
  'Previous login email used for the post-approve ack mail.';
