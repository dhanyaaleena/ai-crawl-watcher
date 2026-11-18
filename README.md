# Crawlwatch

See which AI platforms crawl your website (OpenAI, Anthropic, Google, Perplexity, Meta and more), which pages they read, and how often.

**[Live dashboard](https://ai-crawl-watcher.vercel.app)** · **[Test site with edge forwarding](https://legendary-sawine-97365c.netlify.app)**

[Features](#features) · [Architecture](#architecture) · [Run locally](#run-locally) · [Tests](#tests) · [Deploy](#deploy) · [Limits and next steps](#limits-and-next-steps) · [Work log](#work-log)

**Stack:** Next.js 16 on Vercel · Supabase (Postgres, Auth, Edge Functions) · TypeScript · Tailwind

## Features

- **Overview:** crawler visits with change vs the previous period, active bots, top platform and page, activity chart, training vs retrieval split, live crawl log
- **Platforms, Pages, Activity log:** visits by AI company and purpose, most-crawled pages, every visit with path search
- **Filters:** 24h / 7d / 30d, platform, bot type, applied to every view and export
- **CSV export** of filtered or all data
- **Guided setup:** copy-ready snippets, install check, test visit

## Architecture

![Crawlwatch architecture: crawler visits flow from the customer's website to a Supabase Edge Function, the only writer to Postgres; the Next.js dashboard reads as the signed-in user under row level security](docs/architecture.svg)

Two paths that never share a key. **Writes** go through one Edge Function, the only code holding the key that can insert events. **Reads** come from the dashboard as the signed-in user, and row level security limits every query to that user's own sites. Vercel and Supabase both run in Mumbai.

### How a visit is tracked

1. **A crawler loads a page**, and the visit is reported one of three ways:
   - the `<head>` snippet (about 320 bytes, loaded async);
   - a `<noscript>` pixel, for crawlers that load images but skip JavaScript;
   - a request from the site's own middleware (server or edge), for crawlers that fetch only HTML.
2. **The function classifies the request** from its own user agent against 31 signatures across 18 platforms, typed as training, search or assistant. Other bots are stored as Unknown; human visitors are never stored.
3. **It checks and cleans the data:** the page host must match the site's domain, query strings are dropped, and the IP is truncated (/24 or /48) and then hashed with a secret salt and the site ID.
4. **It stores one row** and always answers with a no-op script, a 1×1 GIF or a 204, so the host page never breaks.
5. **The dashboard reads totals** from four SQL functions that aggregate inside Postgres, so it downloads summaries rather than raw rows.

**Why three capture paths:** I asked real ChatGPT, Claude and Gemini sessions to read the test site. None of their fetchers ran JavaScript; only the test site's edge forwarding caught them. A snippet-only tracker would miss most real AI traffic.

### Key decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| Three capture paths: snippet, `<noscript>` pixel and server/edge forwarding | Real ChatGPT, Claude and Gemini fetches never ran JavaScript; only forwarding caught them | More install options; full coverage needs a server or edge layer on the site |
| Anonymise IPs by truncating (/24, /48), then hashing with a secret salt and the site ID | Can't be reversed, and can't be joined across sites | No per-visitor analysis, and no IP-based checks later |
| Store bots only | Nothing stored about people, and far less data | No human traffic to compare against |
| Totals computed in SQL | Fast as data grows; every view and the CSV agree | Logic lives in migrations, harder to change than TypeScript |
| Check the session over the network once (in the proxy), then verify the token locally | Same protection with one fewer round trip per click | Relies on the project's asymmetric signing keys |
| Fresh data on every click; no prefetch or client cache | Numbers always match the database | ~0.2–0.3 s per click, shown with instant feedback (highlighted filter, progress bar) |
| Polling every 5 s for the live log | Simpler and cheaper than a socket per viewer | Up to a few seconds of delay |
| Vercel pinned to Mumbai, next to the database | Measured ~200 ms per query from the default US region, a few ms after | Users far from India pay one longer hop |
| IP verification of crawlers: built, then removed | Real Claude and Gemini fetches came from unlisted addresses, so genuine visits were labelled fake | User agents can still be faked |

### Security and privacy

- **Keys stay apart:** Vercel has only the public anon key; the service role key stays inside Supabase.
- **Visitor privacy:** IPs are truncated before hashing and salted per site, so they can't be reversed or joined across sites. URLs lose query strings that might carry tokens.
- **Safe install check:** "Check installation" fetches the customer's homepage from our server, following redirects by hand and refusing private, loopback and cloud-metadata addresses (SSRF).
- **CSV injection guard:** cells starting with `= + - @` are escaped, since user agents are attacker-controlled.

## Run locally

Needs Node 24 and Docker.

```bash
npm install && npx supabase start
```

Copy `.env.example` to `.env.local` and fill it from `npx supabase status -o env`, then:

```bash
npm run seed:demo && npm run dev
```

Open http://localhost:3000 and sign in with the demo account `seed:demo` prints. To add traffic to a site, `npm run visits:send -- <site-id> <domain>` sends realistic bot visits through the real endpoint, and `npm run visits:backfill -- <site-id>` writes 30 days of history. Sites filled by `seed:demo` or the backfill show a "Sample data" tag.

## Tests

```bash
npm test && npm run smoke
```

76 unit tests cover classification, URL and IP handling, CSV, time zones and the SSRF guard. The smoke test sends real requests through the tracking function and checks that another user, or an anonymous client, can read nothing. CI runs lint, types, both test suites and a build on every push.

Checked on production: GPTBot, ClaudeBot, PerplexityBot and Google-Extended visits sent through the live endpoint were stored with the right platform and type; "Download all data" returned exactly the rows in the database; a fresh install recorded its first visit in 14 seconds. Real ChatGPT, Claude and Gemini fetches of the test site were captured through its edge forwarding.

## Deploy

1. **Supabase:** `supabase link`, `supabase db push`, set the `IP_HASH_SALT` secret, then `supabase functions deploy track --no-verify-jwt`.
2. **Vercel:** import the repo and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The service role key never goes on Vercel.

## Limits and next steps

- **Most AI fetchers don't run JavaScript**, so sites without server or edge forwarding see only part of their AI traffic.
- **User agents can be faked**, and the site ID is public. Next: a per-site secret for server forwarding and per-site rate limits.
- **Every page view calls the function** (humans are answered, not stored). Supabase's free plan allows 500k calls a month, about 16k page views a day. Next: skip ordinary browsers in the snippet, then upgrade to Pro (2M calls).
- **At larger scale:** daily rollup tables and monthly partitions once dashboard queries pass ~200 ms.

## Work log

Everything built and fixed, grouped by area.

### What was built

#### Tracking

- [x] Tracking snippet for `<head>` (about 320 bytes, loads async) that reports the page URL
- [x] `<noscript>` image pixel for crawlers that load images but skip JavaScript
- [x] Server-side forwarding example for middleware, sending the crawler's own IP
- [x] Netlify edge function on the test site that forwards bot requests and strips the client snippet so visits aren't counted twice
- [x] Supabase Edge Function `track` that answers with a no-op script, a 1×1 GIF or a 204, so the host page never breaks
- [x] `X-Track-Outcome` header (`recorded`, `ignored`, `rejected`) for debugging installs
- [x] Domain check: the page host must match the site's domain or a subdomain
- [x] Site lookup cache (60 s) so each visit doesn't hit the database twice

#### Crawler classification

- [x] 31 crawler signatures across 18 platforms, typed as training, search or assistant
- [x] Unrecognised bots stored as "Unknown" with a readable name (e.g. `Googlebot`); human visitors never stored
- [x] Gemini's bare `Google`, `Google-Agent` and NotebookLM user agents, found from real traffic
- [x] One shared signature list used by the tracker, the dashboard filters and the tests

#### Data and security

- [x] Postgres schema with `timestamptz`, `NOT NULL`s and cascade deletes
- [x] Row level security: owners see and manage only their own sites and events
- [x] Only the tracking function holds the key that can write events; the dashboard has the public key only
- [x] IPs truncated (/24, /48), then hashed with a secret salt and the site ID
- [x] Query strings and fragments removed from stored URLs
- [x] Four SQL functions that compute totals inside the database (overview, bot breakdown, top pages, timeline)
- [x] CSV export with a formula-injection guard, streamed in batches
- [x] SSRF-safe install check: redirects followed by hand and every resolved address checked

#### Dashboard

- [x] Sign up and sign in with email and password
- [x] Add a site, then go straight to setup with the snippet filled in
- [x] Overview: crawler visits with change vs the previous period, active bots, top platform, top page
- [x] Stacked activity chart by platform, in the viewer's time zone
- [x] Training vs retrieval split with per-platform comparison and tooltips
- [x] Live crawl log on the Overview, refreshed every 5 seconds while the tab is visible
- [x] Platforms view: visits by AI company and purpose, per-bot table
- [x] Pages view: top 100 pages with bots, platforms and last crawl
- [x] Activity log: every visit, newest first, with path search and pagination
- [x] Filters for 24h / 7d / 30d, platform and bot type, applied to every view and export
- [x] Settings: setup steps with independent status, install check, test visit, site details, export
- [x] "Sample data" tag on sites filled with generated traffic
- [x] Accessible custom dropdowns (keyboard, screen reader labels, type-to-jump) and tooltips
- [x] Instant feedback while data loads: highlighted filter, progress bar, dimmed page
- [x] Light design inspired by Searchable, responsive down to phone width
- [x] Crawlwatch logo and browser-tab icon

#### Infrastructure and tooling

- [x] Dashboard on Vercel, database, auth and tracking function on Supabase, test site on Netlify
- [x] Vercel functions pinned to the same region as the database
- [x] One-request sign-in that lands straight on the first site
- [x] Demo account seed script and scripts to send live bot visits or backfill 30 days of history
- [x] 76 unit tests (Vitest) and an end-to-end smoke test including row level security checks
- [x] CI on every push: lint, types, unit tests, build and the smoke test against a local Supabase
- [x] README with an architecture diagram, key decisions and trade-offs

#### Tried, then removed

- [x] Crawler verification against the IP ranges AI companies publish: removed because real Claude and Gemini visits came from unlisted addresses and were labelled fake

### Bugs fixed

#### Data and tracking

- [x] Page paths were lost because browsers send only the origin as `Referer`; the snippet now sends the page URL
- [x] Server-forwarded visits stored a hash of the forwarding server's IP; the crawler's IP is now sent in the request body
- [x] Real ChatGPT, Claude and Gemini fetches were invisible to the JavaScript snippet; fixed with edge forwarding
- [x] Gemini visits weren't recognised; added its user agents
- [x] Empty 24h chart in half-hour time zones (e.g. India)
- [x] Test visits marked setup as complete; each setup step now needs its own evidence and test visits never count
- [x] Install check could be pointed at internal addresses through a redirect or DNS record (SSRF)
- [x] 30-day backfill stopped after 1,000 rows (API page limit); now pages through and resumes without duplicates

#### Performance

- [x] Every click was slow because the dashboard ran in Washington while the database was in Mumbai (~200 ms per query); moved next to the database
- [x] Two network auth checks per click; the page now verifies the session token locally
- [x] Sign-in took two server round trips; now one

#### Interface

- [x] Sidebar didn't refresh after adding a site
- [x] Browser-extension hydration warning on load
- [x] Overview figures were cut off by the change badge
- [x] Pages table scrolled sideways; columns now give way on smaller screens
- [x] Activity log Page column took too much space; the user agent column now gets it
- [x] Pagination didn't show which items were on screen
- [x] Site picker overflowed the sidebar
- [x] Site ID wrapped two characters per line in the narrow Settings column
- [x] Hidden tooltips widened the page on phones
- [x] Unwanted orange focus outline around the site search box
- [x] White text on the orange button failed contrast (AA); darkened the button
- [x] Low-contrast secondary text failed AA; darkened it
- [x] Redirect from `/dashboard` dropped the query string

#### Build and CI

- [x] CI type check failed on a fresh checkout because Next.js route types weren't generated yet
