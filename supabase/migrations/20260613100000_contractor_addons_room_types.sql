-- Multi-room targeting for contractor add-ons (dashboard can pick specific rooms).
alter table public.contractor_addons
  add column if not exists room_types text[];

-- Backfill from legacy single room_type column.
update public.contractor_addons
set room_types = array[room_type]
where room_types is null
  and room_type is not null
  and lower(trim(room_type)) <> 'all';
