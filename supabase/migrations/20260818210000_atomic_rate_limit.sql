-- One atomic rate-limit primitive, replacing two racy read-then-write helpers.
--
-- The problem
-- -----------
-- Both src/lib/rateLimit.ts and src/lib/rate-limit.ts read the current count,
-- compared it in JavaScript, then wrote count+1. Under concurrency every
-- request in flight reads the same value and writes the same increment, so the
-- effective limit is roughly "one per round trip" rather than the configured
-- max — worst on exactly the endpoints that matter: signup spam, lead capture,
-- and the AI-spend limiters on intake generation.
--
-- Both also returned "allowed" whenever the database errored, so a failure of
-- the limiter silently removed every limit at once.
--
-- This does the compare and the increment in a single statement. The insert
-- claims the window; the conflict path increments only while under the limit,
-- and the returned count tells the caller which happened.

create table if not exists public.rate_limit_buckets (
  bucket_key   text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket_key, window_start)
);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.rate_limit_hit(
  p_key          text,
  p_window_start timestamptz,
  p_limit        integer
)
returns integer
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

  if v_count is null then
    -- The conflict target existed and the WHERE blocked the update: at or over
    -- the limit. Report the current count so the caller can refuse.
    select b.count into v_count
      from public.rate_limit_buckets b
     where b.bucket_key = p_key and b.window_start = p_window_start;
  end if;

  return v_count;
end;
$$;

comment on function public.rate_limit_hit is
  'Atomically increments a fixed-window counter and returns the resulting count. Returns a count >= p_limit when the caller should be refused. Replaces the read-then-write pattern in src/lib/rateLimit.ts.';

revoke all on function public.rate_limit_hit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, timestamptz, integer) to service_role;

-- Old counters age out; nothing reads a window once it has passed.
create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_start);
