-- Repeat submissions from the same person.
--
-- A visitor who submits the quote form three times in an afternoon — refining
-- the room size, or just double-clicking — currently becomes three leads and
-- three notification emails. The contractor reads that as three customers and
-- calls the same person three times.
--
-- The repeats are kept rather than dropped: a later submission often carries
-- better information than the first, and silently discarding a customer's
-- enquiry is a worse failure than showing a duplicate. They are linked to the
-- lead they repeat, so the inbox can collapse them and the notification can be
-- suppressed.

alter table public.leads
  add column if not exists duplicate_of uuid references public.leads (id) on delete set null;

comment on column public.leads.duplicate_of is
  'Set when this lead repeats an earlier one from the same contractor and email within 24h. Null for the first submission. Written by /api/send-lead.';

-- The lookup is "most recent lead for this contractor + email", so the index
-- has to lead with both and order by time.
create index if not exists leads_contractor_email_recent_idx
  on public.leads (contractor_id, lower(email), created_at desc)
  where email is not null;

create index if not exists leads_duplicate_of_idx
  on public.leads (duplicate_of)
  where duplicate_of is not null;
