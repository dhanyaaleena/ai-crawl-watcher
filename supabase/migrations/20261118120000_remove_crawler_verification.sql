-- Removes crawler IP verification (added in 20261118000000), which is outside
-- the PRD: AI companies' published IP lists don't cover all of their real
-- fetchers (claude.ai's Claude-User and Gemini's were seen from unlisted IPs),
-- so the label couldn't be relied on. sites.is_sample stays.

drop function if exists public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text);

alter table public.crawler_events drop column if exists verification;

create function public.crawler_bot_breakdown(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null
)
returns table (platform text, bot_name text, bot_type text, visits bigint, pages bigint, last_seen timestamptz)
language sql stable
security invoker
set search_path = ''
as $$
    select e.platform::text, e.bot_name::text, e.bot_type::text,
           count(*), count(distinct e.page_path), max(e."timestamp")
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
