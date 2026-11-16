#!/usr/bin/env node
// Creates a demo account with a site and 30 days of realistic crawler traffic,
// so the dashboard can be explored without waiting for real crawlers.
//
//   npm run seed:demo            (uses .env.local)
//
// Local development only: it uses the service role key and a fixed password.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@crawlwatch.test";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "crawlwatch-demo";
const DEMO_DOMAIN = process.env.DEMO_DOMAIN ?? "example.com";
const DAYS = 30;

loadEnv(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// [weight, user agent, bot_name, platform, bot_type] — names match supabase/functions/_shared/bots.ts
const BOTS = [
  [26, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", "GPTBot", "OpenAI", "training"],
  [9, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", "ChatGPT-User", "OpenAI", "assistant"],
  [6, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot", "OAI-SearchBot", "OpenAI", "search"],
  [18, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "Anthropic", "training"],
  [3, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)", "Claude-User", "Anthropic", "assistant"],
  [10, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot", "Perplexity", "search"],
  [2, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)", "Perplexity-User", "Perplexity", "assistant"],
  [4, "Mozilla/5.0 (compatible; Google-Extended/1.0)", "Google-Extended", "Google", "training"],
  [7, "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", "Meta-ExternalAgent", "Meta", "training"],
  [6, "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)", "Bytespider", "ByteDance", "training"],
  [4, "CCBot/2.0 (https://commoncrawl.org/faq/)", "CCBot", "Common Crawl", "training"],
  [3, "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)", "Amazonbot", "Amazon", "search"],
  [1, "Mozilla/5.0 (compatible; Applebot-Extended/0.1)", "Applebot-Extended", "Apple", "training"],
  [1, "DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)", "DuckAssistBot", "DuckDuckGo", "search"],
  [5, "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "Unknown", "unknown"],
  [2, "python-requests/2.32.3", "Unknown", "Unknown", "unknown"],
];

const PAGES = [
  [14, "/"],
  [10, "/blog/what-ai-crawlers-read"],
  [8, "/docs/getting-started"],
  [7, "/pricing"],
  [6, "/blog/robots-txt-for-ai"],
  [6, "/docs/api/events"],
  [5, "/blog"],
  [4, "/docs/tracking-snippet"],
  [4, "/changelog"],
  [3, "/about"],
  [3, "/blog/llms-txt-explained"],
  [2, "/docs/csv-export"],
  [2, "/careers"],
  [1, "/legal/privacy"],
];

const pick = (list) => {
  const total = list.reduce((n, x) => n + x[0], 0);
  let r = Math.random() * total;
  for (const x of list) if ((r -= x[0]) < 0) return x;
  return list[list.length - 1];
};

async function main() {
  // 1. Demo user (idempotent)
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = users?.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }

  // 2. Demo site, reset its events
  let { data: site } = await db.from("sites").select("id").eq("user_id", user.id).eq("domain", DEMO_DOMAIN).maybeSingle();
  if (!site) {
    const { data, error } = await db.from("sites").insert({ user_id: user.id, domain: DEMO_DOMAIN }).select("id").single();
    if (error) throw error;
    site = data;
  }
  await db.from("crawler_events").delete().eq("site_id", site.id);

  // 3. Events: growing trend, busier during US/EU working hours, a crawl burst a week ago.
  const now = Date.now();
  const events = [];
  for (let h = DAYS * 24; h >= 0; h--) {
    const at = now - h * 3_600_000;
    const hourOfDay = new Date(at).getUTCHours();
    const trend = 1 + (DAYS * 24 - h) / (DAYS * 24); // 1x -> 2x over the month
    const diurnal = 0.6 + 0.8 * Math.max(0, Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI));
    const burst = h > 160 && h < 175 ? 6 : 1;
    const n = Math.round(4 * trend * diurnal * burst * (0.6 + Math.random() * 0.8));
    for (let i = 0; i < n; i++) {
      const ts = at - Math.random() * 3_600_000;
      if (ts > now) continue;
      const [, ua, bot_name, platform, bot_type] = pick(BOTS);
      const [, path] = pick(PAGES);
      events.push({
        site_id: site.id,
        timestamp: new Date(ts).toISOString(),
        user_agent: ua,
        bot_name,
        platform,
        bot_type,
        page_url: `https://${DEMO_DOMAIN}${path}`,
        page_path: path,
        ip_hash: [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join(""),
      });
    }
  }
  for (let i = 0; i < events.length; i += 1000) {
    const { error } = await db.from("crawler_events").insert(events.slice(i, i + 1000));
    if (error) throw error;
  }

  console.log(`Seeded ${events.length} crawler events for ${DEMO_DOMAIN}.`);
  console.log(`Sign in at http://localhost:3000/login as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local: rely on the environment
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
