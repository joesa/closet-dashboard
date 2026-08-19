-- A record of every message the platform sends.
--
-- Until now `resend.emails.send` was called from six places with no shared
-- layout, no send log, and no delivery status. That made three questions
-- unanswerable: did the customer's lead notification actually arrive, has this
-- customer already been told their card failed, and what have we sent this
-- person at all. The first is the most common trust question in the category
-- ("I never got the lead"), and the second is the difference between dunning
-- and harassment.
--
-- `idempotency_key` is what makes a retryable dunning cron safe: the same
-- logical message (this customer, this kind, this billing period) can only land
-- once, no matter how many times the job runs.

create table if not exists public.email_sends (
  id                uuid primary key default gen_random_uuid(),
  kind              text        not null,
  to_email          text        not null,
  subject           text        not null,
  -- Who it concerns, when it concerns someone. Nullable: platform mail to a
  -- prospect has neither.
  contractor_id     uuid,
  intake_id         uuid,
  idempotency_key   text unique,
  provider_message_id text,
  status            text        not null default 'sent',
  error             text,
  created_at        timestamptz not null default now(),
  delivered_at      timestamptz,
  failed_at         timestamptz
);

comment on table public.email_sends is
  'One row per outbound message. Written by src/lib/email/send.ts; delivery status updated by the Resend webhook.';
comment on column public.email_sends.idempotency_key is
  'Logical identity of the message (e.g. dunning:<contractor>:<period>:<attempt>). A unique violation means "already sent" and is not an error.';

create index if not exists email_sends_contractor_idx on public.email_sends (contractor_id, created_at desc);
create index if not exists email_sends_kind_idx on public.email_sends (kind, created_at desc);

alter table public.email_sends enable row level security;

-- Service role only: this table names every customer we have ever emailed.
revoke all on public.email_sends from anon, authenticated;
