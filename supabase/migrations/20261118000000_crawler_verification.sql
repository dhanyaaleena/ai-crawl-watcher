-- Crawler verification and sample-data sites.
--
-- crawler_events.verification
--   verified    the visit came from an IP on the operator's published list
--   unverified  the bot has a published list and the IP is not on it (likely an impersonator)
--   unchecked   no published list for this bot, no IP, or the list was unavailable
--   Rows recorded before this migration are 'unchecked'.
--
-- sites.is_sample
--   True for sites filled with generated demo data (scripts/seed-demo.mjs,
--   scripts/backfill-visits.mjs); the dashboard labels them "Sample data".

alter table public.crawler_events
    add column verification varchar(12) not null default 'unchecked'
        check (verification in ('verified', 'unverified', 'unchecked'));

alter table public.sites
    add column is_sample boolean not null default false;

-- The return type changes, so the function is dropped and recreated.
drop function if exists public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text);

create function public.crawler_bot_breakdown(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null
)
returns table (
    platform text, bot_name text, bot_type text,
    visits bigint, pages bigint, last_seen timestamptz,
    verified bigint, unverified bigint
)
language sql stable
security invoker
set search_path = ''
as $$
    select e.platform::text, e.bot_name::text, e.bot_type::text,
           count(*), count(distinct e.page_path), max(e."timestamp"),
           count(*) filter (where e.verification = 'verified'),
           count(*) filter (where e.verification = 'unverified')
    from public.crawler_events e
    where e.site_id = p_site_id
      and e."timestamp" >= p_since and e."timestamp" < p_until
      and (p_platform is null or e.platform = p_platform)
      and (p_bot_type is null or e.bot_type = p_bot_type)
    group by 1, 2, 3
    order by 4 desc, 1, 2;
$$;

revoke execute on function public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text) to authenticated;
