#!/usr/bin/env node
// Adds 30 days of realistic crawler history to an existing site, shaped like
// the demo data (growing trend, day/night rhythm, a burst a week ago). Rows are
// written straight to the database so they can carry past timestamps.
//
//   npm run visits:backfill -- <site-id> [pages] [--spread-existing]
//   npm run visits:backfill -- <site-id> "5:/,3:/blog/robots-txt-for-ai.html,2:/about.html" --spread-existing
//
// --spread-existing also moves the site's current visits to random times in the
// last 30 days (e.g. visits just sent with visits:send). Needs
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local
// unless already set). Running it twice adds history twice. The site is marked
// as sample data, so the dashboard labels it; generated visits get realistic
// IP-check labels (scripts/lib/demo-traffic.mjs), never real verification.

import { createClient } from "@supabase/supabase-js";
import { generateHistory, loadEnv, parsePages } from "./lib/demo-traffic.mjs";

const DAYS = 30;
loadEnv(".env.local");
const args = process.argv.slice(2);
const spread = args.includes("--spread-existing");
const [siteId, pagesArg = "/"] = args.filter((a) => !a.startsWith("--"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!siteId || !url || !key) {
  console.error("usage: npm run visits:backfill -- <site-id> [pages] [--spread-existing]");
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: site, error } = await db.from("sites").select("id, domain").eq("id", siteId).maybeSingle();
  if (error) throw error;
  if (!site) throw new Error(`No site with id ${siteId} on ${new URL(url).host}.`);

  const { error: markError } = await db.from("sites").update({ is_sample: true }).eq("id", site.id);
  if (markError) throw markError;

  const now = Date.now();
  if (spread) {
    let moved = 0;
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await db.from("crawler_events").select("id").eq("site_id", site.id).range(from, from + 999);
      if (e) throw e;
      for (const { id } of data) {
        const timestamp = new Date(now - Math.random() * DAYS * 86_400_000).toISOString();
        const { error: u } = await db.from("crawler_events").update({ timestamp }).eq("id", id);
        if (u) throw u;
        moved++;
      }
      if (data.length < 1000) break;
    }
    console.log(`Moved ${moved} existing visits into the last ${DAYS} days.`);
  }

  const events = generateHistory({ siteId: site.id, domain: site.domain, pages: parsePages(pagesArg), days: DAYS, now });
  for (let i = 0; i < events.length; i += 1000) {
    const { error: e } = await db.from("crawler_events").insert(events.slice(i, i + 1000));
    if (e) throw new Error(`Inserted ${i} of ${events.length} before failing: ${e.message}`);
  }
  console.log(`Added ${events.length} visits over the last ${DAYS} days for ${site.domain}.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
