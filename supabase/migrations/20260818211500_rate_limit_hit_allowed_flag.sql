-- rate_limit_hit returns whether the caller was actually admitted.
--
-- The first version returned only the resulting count, which cannot distinguish
-- "you are the 5th of 5" from "you were refused at 5" — both read 5. A caller
-- comparing count <= limit therefore admits one request too many at every
-- window boundary, and worse, admits every refused request as well. Verified
-- against the real function with 20 concurrent hits before changing it.
--
-- The insert path returns a row only when it actually wrote, so "did we write"
-- is the admission decision; the fallback select is purely for reporting.

drop function if exists public.rate_limit_hit(text, timestamptz, integer);

create or replace function public.rate_limit_hit(
  p_key          text,
  p_window_start timestamptz,
  p_limit        integer
)
returns table (new_count integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limit_buckets as b (bucket_key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (bucket_key, window_start) do update
    set count = b.count + 1
    where b.count < p_limit
  returning b.count into v_count;

  if v_count is not null then
    return query select v_count, true;
    return;
  end if;

  select b.count into v_count
    from public.rate_limit_buckets b
   where b.bucket_key = p_key and b.window_start = p_window_start;

  return query select coalesce(v_count, p_limit), false;
end;
$$;

comment on function public.rate_limit_hit is
  'Atomically increments a fixed-window counter. Returns (new_count, allowed); allowed is false when the window is already at p_limit. Used by src/lib/rateLimit.ts.';

revoke all on function public.rate_limit_hit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, timestamptz, integer) to service_role;
