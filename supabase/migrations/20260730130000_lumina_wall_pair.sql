-- =============================================================================
-- Lumina same-niche before/after pair
--
-- The deployed site (custom-closets-websites commit 22687be, merged to main)
-- deleted /brands/lumina/after-closet.png and shipped matched elevation
-- drawings of the same 6'-6" niche:
--   /brands/lumina/wall-before.png  (field survey, job no. 24-0619)
--   /brands/lumina/wall-after.png   (as-built elevation, same niche)
-- but before_after_config still pointed at the deleted file, so the "After"
-- layer 404'd and the slider showed the same photo on both sides.
--
-- Point the config at the matched pair and give the section copy that reads
-- from the sheets themselves.
-- =============================================================================

do $demo$
declare
  lumina_tid uuid;
begin
  select t.id into lumina_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('lumina.ditchtheform.com', 'lumina.closetquotes.com', 'lumina.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  if lumina_tid is null then
    raise exception 'Lumina demo tenant not found';
  end if;

  update public.site_configs
  set
    before_after_config = '{
      "beforeImage": "/brands/lumina/wall-before.png",
      "afterImage": "/brands/lumina/wall-after.png",
      "title": "The same niche, surveyed to as-built",
      "subtitle": "Job no. 24-0619 \u2014 field survey to installed elevation"
    }'::jsonb
  where tenant_id = lumina_tid;
end
$demo$;
