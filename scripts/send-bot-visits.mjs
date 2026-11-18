#!/usr/bin/env node
// Sends a mix of AI crawler visits to a site through the real tracking
// endpoint, the same request the snippet makes. Visits are stamped "now".
//
//   npm run visits:send -- <site-id> <domain> [count] [pages]
//   npm run visits:send -- <site-id> my-site.netlify.app 40 "5:/,3:/blog,2:/about"
//
// Endpoint: TRACK_ENDPOINT, else $NEXT_PUBLIC_SUPABASE_URL/functions/v1/track
// (both read from .env.local unless already set).

import { BOTS, loadEnv, parsePages, pick } from "./lib/demo-traffic.mjs";

loadEnv(".env.local");
const [siteId, domain, countArg = "40", pagesArg = "/"] = process.argv.slice(2);
if (!siteId || !domain) {
  console.error("usage: npm run visits:send -- <site-id> <domain> [count] [pages]");
  process.exit(1);
}
const endpoint =
  process.env.TRACK_ENDPOINT ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL && `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/track`);
if (!endpoint) {
  console.error("Set TRACK_ENDPOINT or NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
const count = Math.max(1, Math.min(500, Number.parseInt(countArg, 10) || 40));
const pages = parsePages(pagesArg);

const outcomes = {};
for (let i = 0; i < count; i++) {
  const [, ua] = pick(BOTS);
  const [, path] = pick(pages);
  const url = `${endpoint}?sid=${encodeURIComponent(siteId)}&u=${encodeURIComponent(`https://${domain}${path}`)}`;
  const res = await fetch(url, { headers: { "User-Agent": ua } });
  await res.arrayBuffer();
  const outcome = res.headers.get("x-track-outcome") ?? `http ${res.status}`;
  outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
}
console.log(`Sent ${count} visits to ${new URL(endpoint).host} for ${domain}:`, outcomes);
if (outcomes.rejected) console.log("Rejected visits: check the Site ID and that the domain matches the site's domain.");
