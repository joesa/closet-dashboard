-- Stop edit-in-place from taking a paying customer's site offline forever.
--
-- `edit_in_place` outranks site_status in the renderer's gate, so while it is
-- set the public site serves a "Site Being Updated" holding page. There was no
-- expiry and no operator timeout: an admin who opened edit mode and got
-- distracted left the business's homepage as a holding page indefinitely, and
-- nothing anywhere would report it.
--
-- Recording when the flag went on lets the renderer expire it. The direction of
-- failure is deliberate — after the window the real site comes back, because a
-- half-finished edit shown to visitors is a smaller harm than a site that never
-- returns.

alter table public.site_configs
  add column if not exists edit_in_place_started_at timestamptz;

comment on column public.site_configs.edit_in_place_started_at is
  'When edit_in_place was last switched on. The renderer ignores edit_in_place once this is older than EDIT_IN_PLACE_MAX_MS (see src/lib/siteGate.ts). Null while edit_in_place is true means the flag predates this column and is treated as expired.';

-- Backfill so sites already in edit mode expire promptly rather than never.
update public.site_configs
   set edit_in_place_started_at = coalesce(updated_at, now())
 where edit_in_place is true
   and edit_in_place_started_at is null;

-- The renderer reads site_configs as `anon` under a column-level grant. A
-- column missing from this grant makes PostgREST fail the entire select, which
-- takes every tenant site down — this grant is not optional.
grant select (edit_in_place_started_at) on public.site_configs to anon;
