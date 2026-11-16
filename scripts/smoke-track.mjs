#!/usr/bin/env node
// End-to-end check of the tracking pipeline: sends requests to the deployed
// `track` edge function with real crawler user agents and verifies what was
// stored. Run after `npm run seed:demo` (it uses the demo site).
//
//   npm run smoke

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const endpoint = process.env.NEXT_PUBLIC_TRACK_ENDPOINT ?? `${url}/functions/v1/track`;
const domain = process.env.DEMO_DOMAIN ?? "example.com";

const { data: site, error } = await db.from("sites").select("id").eq("domain", domain).limit(1).single();
if (error) throw new Error(`No site for ${domain}; run npm run seed:demo first`);
const marker = `/smoke/${Date.now()}`;

const CASES = [
  { name: "GPTBot via script", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", expect: "recorded", platform: "OpenAI" },
  { name: "ClaudeBot via script", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", expect: "recorded", platform: "Anthropic" },
  { name: "PerplexityBot via script", ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", expect: "recorded", platform: "Perplexity" },
  { name: "Google-Extended via script", ua: "Mozilla/5.0 (compatible; Google-Extended/1.0)", expect: "recorded", platform: "Google" },
  { name: "Unknown bot via gif", ua: "SomeNewCrawlerBot/0.1", expect: "recorded", platform: "Unknown", gif: true },
  { name: "ChatGPT-User via POST", ua: "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", expect: "recorded", platform: "OpenAI", post: true },
  { name: "Chrome (human) ignored", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", expect: "ignored" },
  { name: "Wrong domain rejected", ua: "GPTBot/1.2", expect: "rejected", page: "https://not-my-site.io/x" },
  { name: "Bad site id rejected", ua: "GPTBot/1.2", expect: "rejected", sid: "not-a-uuid" },
];

let failed = 0;
for (const c of CASES) {
  const sid = c.sid ?? site.id;
  const page = c.page ?? `https://www.${domain}${marker}?utm_source=x#frag`;
  let res;
  if (c.post) {
    res = await fetch(endpoint, { method: "POST", headers: { "user-agent": c.ua, "content-type": "text/plain" }, body: JSON.stringify({ sid, u: page }) });
  } else if (c.gif) {
    res = await fetch(`${endpoint}?sid=${sid}&f=gif`, { headers: { "user-agent": c.ua, referer: page } });
  } else {
    res = await fetch(`${endpoint}?sid=${sid}&u=${encodeURIComponent(page)}`, { headers: { "user-agent": c.ua } });
  }
  const outcome = res.headers.get("x-track-outcome");
  const ok = res.ok && outcome === c.expect;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(28)} status=${res.status} outcome=${outcome} type=${res.headers.get("content-type") ?? "-"}`);
}

const { data: rows } = await db.from("crawler_events").select("bot_name, platform, page_url, page_path, ip_hash").eq("site_id", site.id).eq("page_path", marker);
const stored = rows ?? [];
const expected = CASES.filter((c) => c.expect === "recorded");
const storedOk =
  stored.length === expected.length &&
  expected.every((c) => stored.some((r) => r.platform === c.platform)) &&
  stored.every((r) => r.page_url === `https://www.${domain}${marker}`);
if (!storedOk) failed++;
console.log(`${storedOk ? "PASS" : "FAIL"}  stored rows: ${stored.length}/${expected.length}, query string stripped: ${stored.every((r) => !r.page_url.includes("?"))}`);
await db.from("crawler_events").delete().eq("site_id", site.id).eq("page_path", marker);

// Row level security: another signed-in user and an anonymous client see none of the demo site's data.
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const opts = { auth: { persistSession: false } };
const outsiderEmail = `rls-check-${Date.now()}@crawlwatch.test`;
const outsiderPassword = crypto.randomUUID();
const { data: created } = await db.auth.admin.createUser({ email: outsiderEmail, password: outsiderPassword, email_confirm: true });
const outsider = createClient(url, anonKey, opts);
await outsider.auth.signInWithPassword({ email: outsiderEmail, password: outsiderPassword });
const anon = createClient(url, anonKey, opts);
const since = new Date(Date.now() - 30 * 864e5).toISOString();
const checks = {
  "outsider events": (await outsider.from("crawler_events").select("id").eq("site_id", site.id).limit(1)).data?.length ?? 0,
  "outsider sites": (await outsider.from("sites").select("id").eq("id", site.id)).data?.length ?? 0,
  "outsider rpc visits": Number((await outsider.rpc("crawler_overview", { p_site_id: site.id, p_since: since }).single()).data?.total_visits ?? 0),
  "anon events": (await anon.from("crawler_events").select("id").limit(1)).data?.length ?? 0,
  "outsider insert blocked": (await outsider.from("crawler_events").insert({ site_id: site.id, user_agent: "x", page_url: "https://example.com/" })).error ? 0 : 1,
};
await db.auth.admin.deleteUser(created.user.id);
const rlsOk = Object.values(checks).every((n) => n === 0);
if (!rlsOk) failed++;
console.log(`${rlsOk ? "PASS" : "FAIL"}  row level security ${JSON.stringify(checks)}`);

process.exit(failed ? 1 : 0);
