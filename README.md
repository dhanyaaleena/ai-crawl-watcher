# Crawlwatch: AI Crawler Analytics

See which AI platforms (OpenAI, Anthropic, Google, Perplexity, Meta, ByteDance and others) crawl your website, which pages they fetch, and how often.

Built with **Supabase** (Postgres, Auth, Edge Functions) and **Next.js 16**, following the AI Crawler Analytics PRD.

```
 customer site ──snippet / pixel / server forward──▶  Edge Function `track`  ──service role──▶  Postgres
                                                     (classify UA, check domain,                (RLS: owners read
                                                      hash IP, drop humans)                       only their sites)
                                                                                                     │
                                Next.js dashboard  ◀── anon key + user session (RLS) ───────────────┘
                                (Overview, Platforms, Pages, Activity, Settings, CSV export)
```

## Quick start (local, about 5 minutes)

Requirements: Node 24 (see `.nvmrc`; run `nvm use` if you have nvm), Docker running.

```bash
npm install
```

```bash
npx supabase start          # Postgres, Auth, Edge Functions; applies the migration
```

```bash
cp .env.example .env.local  # then paste API_URL / ANON_KEY / SERVICE_ROLE_KEY from `npx supabase status -o env`
```

```bash
npm run seed:demo           # demo account + 30 days of realistic crawler traffic
```

```bash
npm run dev                 # http://localhost:3000
```

Sign in with the demo account printed by `seed:demo` (defined at the top of `scripts/seed-demo.mjs`), or create your own account and add a site.

### Sample traffic for any site

```bash
npm run visits:send -- <site-id> <domain> 40 "5:/,3:/blog,2:/about"   # 40 bot visits through the real tracking endpoint, stamped now
```

```bash
npm run visits:backfill -- <site-id> "5:/,3:/blog,2:/about" --spread-existing   # 30 days of history written to the database
```

Pages are `weight:path`, comma-separated. `visits:send` only needs the endpoint (`TRACK_ENDPOINT` or `NEXT_PUBLIC_SUPABASE_URL`) and the site's own domain. `visits:backfill` needs `SUPABASE_SERVICE_ROLE_KEY`, adds history each time it runs, and with `--spread-existing` first moves the site's current visits across the 30 days. Both use the bot mix in `scripts/lib/demo-traffic.mjs`. Everything they write is real data for that site, so point them at demo or test sites only.

### Checks

```bash
npm test          # 76 unit tests: classifier, URL/IP handling, CSV, time ranges, snippet size, training vs retrieval, SSRF guard
```

```bash
npm run smoke     # end to end against the running edge function + RLS isolation checks
```

```bash
npm run typecheck && npm run lint && npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs all of these on every push and pull request: lint, types, unit tests and a production build in one job; in a second job, a local Supabase stack, the demo seed and `npm run smoke`, so a broken row level security policy fails the build.

## What's in the box

| Area | Where | Notes |
| --- | --- | --- |
| Schema, RLS, analytics SQL | `supabase/migrations/20261116000000_crawler_analytics.sql` | PRD schema plus `NOT NULL`s, `timestamptz`, cascade deletes, owner insert/update/delete on `sites`, and four `SECURITY INVOKER` aggregate functions so RLS applies to every chart |
| Bot classification | `supabase/functions/_shared/bots.ts` | 28 signatures across 18 platforms, typed `training` / `search` / `assistant`; other bots are stored as **Unknown** with a readable name (e.g. `Googlebot`); browsers are ignored. Shared by the edge function, dashboard and tests |
| Tracking endpoint | `supabase/functions/track/index.ts` | `GET` → no-op JS (snippet), `GET &f=gif` → 1×1 GIF (`<noscript>`), `POST` → 204 (sendBeacon / server forwarding). Never errors toward the host page |
| Dashboard | `src/app/dashboard/[siteId]/…` | Overview, Platforms, Pages, Activity log, Settings |
| CSV export | `src/app/api/export/route.ts` | Streams in keyset-paginated batches of 1,000; current filters or `all=1` |
| Demo + smoke scripts | `scripts/` | `seed-demo.mjs`, `send-bot-visits.mjs`, `backfill-visits.mjs`, `smoke-track.mjs`; shared bot mix in `lib/demo-traffic.mjs` |

## Worth trying

- **Training vs retrieval** (Overview): splits AI traffic into training crawlers and retrieval bots (search indexing and on-demand assistant fetches), with the change vs the previous period, a one-line summary and a per-platform comparison. The Platforms page breaks the same groups down by bot type. Built on the PRD's bot types (FR-2.3).
- **Sample data label**: sites filled by `seed:demo` or `visits:backfill` are marked `is_sample` and show a "Sample data" tag on every page, so generated traffic is never mistaken for real visits.
- **Live install status** (Settings): while a new site has no data, the page listens for the first visit and announces it the moment it lands. "Send a test visit" pushes one request through the real tracking endpoint; it's stored as an Unknown bot named `Crawlwatch-TestBot` on `/crawlwatch-test`, never as a real AI crawler.

## Installing the tracker on a site

Settings shows the code with the site id filled in:

1. **`<head>` snippet** (about 320 bytes, async): injects `<script src=".../track?sid=…&u=<page url>">`. The edge function classifies the **request's own User-Agent**, so the crawler identifies itself just by loading the script.
2. **`<noscript>` pixel** right after `<body>`: for crawlers that don't run JavaScript but do fetch images. The page comes from the `Referer` (`referrerpolicy="no-referrer-when-downgrade"` keeps the full path).
3. **Optional server-side forwarding** (shown under Settings): a short middleware that POSTs bot requests to the same endpoint, with the crawler's IP so the stored (hashed) address is the crawler's rather than your server's. This is the only way to see crawlers that fetch nothing but HTML, which includes most AI crawlers and every "ask ChatGPT/Claude to read this page" fetch.

"Check installation" fetches the site's homepage server side and looks for the site id. Private, IP-literal and reserved hostnames are refused to avoid SSRF.

## Acceptance criteria

| # | Criterion | How it's met / verified |
| --- | --- | --- |
| AC-1 | Detects GPTBot, ClaudeBot, PerplexityBot, Google-Extended | Unit tests with vendor UA strings; `npm run smoke` sends each through the live edge function and checks the stored row |
| AC-2 | Visits grouped by platform | Overview bars and stacked timeline, Platforms page (bars, purpose split, per-bot table) |
| AC-3 | Top pages ranked by visit count | Pages view (top 100) and Overview card; `crawler_top_pages` orders by `count(*) desc` |
| AC-4 | Date range filtering | 24h / 7d / 30d presets in the URL, applied to every view and the export; platform and bot-type filters too |
| AC-5 | CSV export of all crawler data | Settings → "Download all data" (`all=1`); every view also exports its filtered rows. Verified: 4,249 seeded rows exported, all unique, in order |
| AC-6 | Install in under 5 minutes | Sign up → add domain → redirected to Settings with the code, copy buttons, install check and a live "last crawler visit" status |

## Decisions worth knowing

- **Only bots are stored.** Ordinary browsers get the no-op script and no row is written, which keeps volume (and privacy exposure) low. Unknown automated clients are kept, per FR-2.4.
- **Domain check.** An event is accepted only if the page host is the site's domain or a subdomain, so a snippet copied onto another website is rejected. It stops accidental reuse, not deliberate forgery: the Site ID is public, so anyone can send a request with a matching URL. A per-site secret for server forwarding plus rate limits is the planned fix.
- **Privacy.** IPs are truncated (IPv4 /24, IPv6 /48) and then SHA-256 hashed with a secret salt and the site id, so the hash can't be reversed even if the salt leaks and can't be joined across sites. Query strings and fragments are dropped from URLs, since they often carry tokens.
- **Aggregation in Postgres.** Charts call SQL functions instead of pulling raw rows to the browser; indexes cover `(site_id, timestamp)`, `(site_id, platform, timestamp)` and `(site_id, page_path)`.
- **Time zones.** The browser's zone is stored in a cookie; day buckets start at local midnight and hour buckets at local hours (tested for DST and half-hour offsets such as India).
- **CSV safety.** Cells starting with `= + - @` are prefixed with `'` because user agents are attacker-controlled (spreadsheet formula injection). Column order follows the PRD appendix, then `page_path` and `ip_hash`.
- **Colours** follow the platform, not its rank. The seven most common platforms have fixed, colour-blind-checked slots; the long tail shares one neutral "Other" in stacked charts, and every bar is labelled directly.
- **Node 24.** Node 20 is past end of life and current supabase-js needs Node 22+; 24 is used for its longer support window. The edge function runs on Supabase's Deno runtime and doesn't depend on this.
- **Install check is SSRF-safe.** "Check installation" fetches the customer's homepage from our server. `src/lib/safe-fetch.ts` follows redirects by hand (at most 3) and vets the address inside the socket's DNS lookup, so neither a redirect nor a DNS record can point it at a private, loopback or cloud-metadata address.
- **One auth round trip per click.** `proxy.ts` asks Supabase Auth to validate the session (it also catches sessions signed out elsewhere); the dashboard layout then verifies the token locally with `getClaims()` against the project's public signing key, instead of a second network call.
- **Next.js 16** scaffold enabled Cache Components; it's switched off because every dashboard view is per-user and request-time.

## Known limitations

- **Most AI training crawlers don't execute JavaScript** (PRD risk table). The pixel and server-forwarding options reduce the gap; full coverage needs server or CDN log ingestion (v2).
- **`Google-Extended` and `Applebot-Extended` are robots.txt control tokens.** Google and Apple crawl with Googlebot/Applebot, so these names rarely or never appear in a real User-Agent. They're matched if they do; Googlebot itself is recorded as Unknown, since it's a search crawler.
- **User agents can be spoofed.** Checking visits against the IP ranges AI companies publish was built and tested, then removed: real claude.ai (Claude-User) and Gemini fetches came from addresses outside those lists, so the check would have mislabelled genuine visits. It works for the big crawlers (GPTBot, ClaudeBot, PerplexityBot) and could return if the lists become complete.
- **No rate limiting** on the public endpoint beyond the domain check; add a gateway rule or per-site quotas for production.
- Exact `count` on the activity log is fine at demo scale; switch to `estimated` for very large tables.

## Capacity and upgrade path

This is the PRD's mitigation for high-volume sites. Plan limits are from [Supabase pricing](https://supabase.com/pricing) (check the live page); event size was measured locally at about 1.3 KB per stored visit, indexes included.

| | Free | Pro ($25/month) |
| --- | --- | --- |
| Edge Function calls | 500k / month | 2M included, then $2 per million |
| Database | 500 MB ≈ 380k stored crawler visits | 8 GB ≈ 6M visits, disk grows automatically |

- **Function calls are the first limit.** Every page view that loads the `<head>` snippet calls the endpoint, humans included (they are answered, not stored). On the free plan that is roughly 16k page views a day. The fix before upgrading: a broad user-agent check in the snippet so ordinary browsers never call the endpoint, with the server keeping the final say on classification.
- **Storage is next.** Past a few million visits per site: daily rollup tables (refreshed with `pg_cron`, today still read live), monthly partitions of `crawler_events`, and a retention window.
- **Upgrade order:** add the snippet filter → Supabase Pro → rollups and partitions → a read replica for the dashboard if reads compete with ingest.

## Deploying

**1. Supabase (database, auth, tracking endpoint).** Create a project at supabase.com, then:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

```bash
npx supabase secrets set IP_HASH_SALT=$(openssl rand -hex 32)
```

```bash
npx supabase functions deploy track --no-verify-jwt
```

**2. Dashboard (Vercel).** Push the repo to GitHub, import it in Vercel, and set:

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon or publishable key from the same page

Vercel reads Node 24 from `engines` in `package.json`.

**3. Auth settings.** In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel URL. Hosted projects require email confirmation by default and send only a few emails per hour; add custom SMTP for real users, or turn confirmation off while testing.

The tracking snippet in Settings picks up the hosted endpoint automatically (`$NEXT_PUBLIC_SUPABASE_URL/functions/v1/track`). Don't set `SUPABASE_SERVICE_ROLE_KEY` on Vercel; only the local seed and smoke scripts use it.
