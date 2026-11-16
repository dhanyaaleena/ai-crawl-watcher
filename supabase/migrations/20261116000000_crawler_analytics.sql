-- AI Crawler Analytics: schema, row level security and analytics functions.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sites (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    -- Bare lowercase hostname, e.g. "example.com". Subdomains are accepted by the tracker.
    domain      text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$'),
    created_at  timestamptz not null default now(),
    unique (user_id, domain)
);

create table public.crawler_events (
    id          uuid primary key default gen_random_uuid(),
    site_id     uuid not null references public.sites(id) on delete cascade,
    "timestamp" timestamptz not null default now(),
    user_agent  text not null,
    bot_name    varchar(100) not null default 'Unknown',
    platform    varchar(50)  not null default 'Unknown',
    bot_type    varchar(20)  not null default 'unknown'
                check (bot_type in ('training', 'search', 'assistant', 'unknown')),
    page_url    text not null,
    page_path   varchar(500),
    ip_hash     varchar(64)
);

create index idx_sites_user on public.sites(user_id);
create index idx_events_site_time on public.crawler_events(site_id, "timestamp" desc);
create index idx_events_site_platform_time on public.crawler_events(site_id, platform, "timestamp" desc);
create index idx_events_site_path on public.crawler_events(site_id, page_path);

-- ---------------------------------------------------------------------------
-- Row level security
-- Users manage their own sites. Events are read-only for their owners; only the
-- tracking edge function (service role, bypasses RLS) writes events.
-- ---------------------------------------------------------------------------

alter table public.sites enable row level security;
alter table public.crawler_events enable row level security;

create policy "Users can view own sites" on public.sites
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add own sites" on public.sites
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own sites" on public.sites
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own sites" on public.sites
    for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own events" on public.crawler_events
    for select to authenticated
    using (site_id in (select id from public.sites where user_id = (select auth.uid())));

revoke all on public.sites, public.crawler_events from anon;
revoke insert, update, delete, truncate on public.crawler_events from authenticated;

-- ---------------------------------------------------------------------------
-- Analytics functions
-- SECURITY INVOKER (the default), so RLS applies: a caller only ever aggregates
-- events from sites they own. Optional filters are ignored when null.
-- ---------------------------------------------------------------------------

create or replace function public.crawler_overview(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null
)
returns table (
    total_visits        bigint,
    previous_visits     bigint,
    active_bots         bigint,
    pages_crawled       bigint,
    top_platform        text,
    top_platform_visits bigint,
    top_page            text,
    top_page_visits     bigint,
    last_seen           timestamptz
)
language sql stable
set search_path = ''
as $$
    with scoped as (
        select e.*
        from public.crawler_events e
        where e.site_id = p_site_id
          and e."timestamp" >= p_since and e."timestamp" < p_until
          and (p_platform is null or e.platform = p_platform)
          and (p_bot_type is null or e.bot_type = p_bot_type)
    ),
    previous as (
        select count(*) as n
        from public.crawler_events e
        where e.site_id = p_site_id
          and e."timestamp" >= p_since - (p_until - p_since) and e."timestamp" < p_since
          and (p_platform is null or e.platform = p_platform)
          and (p_bot_type is null or e.bot_type = p_bot_type)
    ),
    top_platform as (
        select platform, count(*) as n from scoped group by platform order by n desc, platform limit 1
    ),
    top_page as (
        select page_path, count(*) as n from scoped group by page_path order by n desc, page_path limit 1
    )
    select
        (select count(*) from scoped),
        (select n from previous),
        (select count(distinct bot_name) from scoped),
        (select count(distinct page_path) from scoped),
        (select platform::text from top_platform),
        (select n from top_platform),
        (select page_path::text from top_page),
        (select n from top_page),
        (select max("timestamp") from scoped);
$$;

create or replace function public.crawler_bot_breakdown(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null
)
returns table (platform text, bot_name text, bot_type text, visits bigint, pages bigint, last_seen timestamptz)
language sql stable
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

create or replace function public.crawler_top_pages(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null,
    p_limit     int default 100
)
returns table (page_path text, page_url text, visits bigint, bots bigint, platforms text[], last_seen timestamptz)
language sql stable
set search_path = ''
as $$
    select e.page_path::text,
           max(e.page_url),
           count(*),
           count(distinct e.bot_name),
           array_agg(distinct e.platform::text order by e.platform::text),
           max(e."timestamp")
    from public.crawler_events e
    where e.site_id = p_site_id
      and e."timestamp" >= p_since and e."timestamp" < p_until
      and (p_platform is null or e.platform = p_platform)
      and (p_bot_type is null or e.bot_type = p_bot_type)
    group by e.page_path
    order by 3 desc, 1
    limit least(greatest(p_limit, 1), 1000);
$$;

-- Visits per time bucket and platform. Buckets are computed in the caller's
-- time zone and returned as UTC instants; empty buckets are filled client side.
create or replace function public.crawler_timeseries(
    p_site_id   uuid,
    p_since     timestamptz,
    p_until     timestamptz default now(),
    p_platform  text default null,
    p_bot_type  text default null,
    p_bucket    text default 'day',
    p_tz        text default 'UTC'
)
returns table (bucket timestamptz, platform text, visits bigint)
language sql stable
set search_path = ''
as $$
    select date_trunc(case when p_bucket = 'hour' then 'hour' else 'day' end, e."timestamp", p_tz),
           e.platform::text,
           count(*)
    from public.crawler_events e
    where e.site_id = p_site_id
      and e."timestamp" >= p_since and e."timestamp" < p_until
      and (p_platform is null or e.platform = p_platform)
      and (p_bot_type is null or e.bot_type = p_bot_type)
    group by 1, 2
    order by 1, 2;
$$;

revoke execute on function
    public.crawler_overview(uuid, timestamptz, timestamptz, text, text),
    public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text),
    public.crawler_top_pages(uuid, timestamptz, timestamptz, text, text, int),
    public.crawler_timeseries(uuid, timestamptz, timestamptz, text, text, text, text)
from public, anon;

grant execute on function
    public.crawler_overview(uuid, timestamptz, timestamptz, text, text),
    public.crawler_bot_breakdown(uuid, timestamptz, timestamptz, text, text),
    public.crawler_top_pages(uuid, timestamptz, timestamptz, text, text, int),
    public.crawler_timeseries(uuid, timestamptz, timestamptz, text, text, text, text)
to authenticated;
