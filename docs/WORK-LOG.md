# Work log

Everything built and fixed in Crawlwatch, grouped by area. Back to the [README](../README.md).

## What was built

### Tracking

- [x] Tracking snippet for `<head>` (about 320 bytes, loads async) that reports the page URL
- [x] `<noscript>` image pixel for crawlers that load images but skip JavaScript
- [x] Server-side forwarding example for middleware, sending the crawler's own IP
- [x] Netlify edge function on the test site that forwards bot requests and strips the client snippet so visits aren't counted twice
- [x] Supabase Edge Function `track` that answers with a no-op script, a 1×1 GIF or a 204, so the host page never breaks
- [x] `X-Track-Outcome` header (`recorded`, `ignored`, `rejected`) for debugging installs
- [x] Domain check: the page host must match the site's domain or a subdomain
- [x] Site lookup cache (60 s) so each visit doesn't hit the database twice

### Crawler classification

- [x] 31 crawler signatures across 18 platforms, typed as training, search or assistant
- [x] Unrecognised bots stored as "Unknown" with a readable name (e.g. `Googlebot`); human visitors never stored
- [x] Gemini's bare `Google`, `Google-Agent` and NotebookLM user agents, found from real traffic
- [x] One shared signature list used by the tracker, the dashboard filters and the tests

### Data and security

- [x] Postgres schema with `timestamptz`, `NOT NULL`s and cascade deletes
- [x] Row level security: owners see and manage only their own sites and events
- [x] Only the tracking function holds the key that can write events; the dashboard has the public key only
- [x] IPs truncated (/24, /48), then hashed with a secret salt and the site ID
- [x] Query strings and fragments removed from stored URLs
- [x] Four SQL functions that compute totals inside the database (overview, bot breakdown, top pages, timeline)
- [x] CSV export with a formula-injection guard, streamed in batches
- [x] SSRF-safe install check: redirects followed by hand and every resolved address checked

### Dashboard

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

### Infrastructure and tooling

- [x] Dashboard on Vercel, database, auth and tracking function on Supabase, test site on Netlify
- [x] Vercel functions pinned to the same region as the database
- [x] One-request sign-in that lands straight on the first site
- [x] Demo account seed script and scripts to send live bot visits or backfill 30 days of history
- [x] 76 unit tests (Vitest) and an end-to-end smoke test including row level security checks
- [x] CI on every push: lint, types, unit tests, build and the smoke test against a local Supabase
- [x] README with an architecture diagram, key decisions and trade-offs

### Tried, then removed

- [x] Crawler verification against the IP ranges AI companies publish: removed because real Claude and Gemini visits came from unlisted addresses and were labelled fake

## Bugs fixed

### Data and tracking

- [x] Page paths were lost because browsers send only the origin as `Referer`; the snippet now sends the page URL
- [x] Server-forwarded visits stored a hash of the forwarding server's IP; the crawler's IP is now sent in the request body
- [x] Real ChatGPT, Claude and Gemini fetches were invisible to the JavaScript snippet; fixed with edge forwarding
- [x] Gemini visits weren't recognised; added its user agents
- [x] Empty 24h chart in half-hour time zones (e.g. India)
- [x] Test visits marked setup as complete; each setup step now needs its own evidence and test visits never count
- [x] Install check could be pointed at internal addresses through a redirect or DNS record (SSRF)
- [x] 30-day backfill stopped after 1,000 rows (API page limit); now pages through and resumes without duplicates

### Performance

- [x] Every click was slow because the dashboard ran in Washington while the database was in Mumbai (~200 ms per query); moved next to the database
- [x] Two network auth checks per click; the page now verifies the session token locally
- [x] Sign-in took two server round trips; now one

### Interface

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

### Build and CI

- [x] CI type check failed on a fresh checkout because Next.js route types weren't generated yet
