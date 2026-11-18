// Shared by the demo scripts: a weighted mix of real AI crawler user agents and
// a generator for 30 days of realistic traffic.

import { readFileSync } from "node:fs";

// [weight, user agent, bot_name, platform, bot_type]; names match supabase/functions/_shared/bots.ts
export const BOTS = [
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
  [2, "Mozilla/5.0 (compatible; MyCustomBot/1.0)", "MyCustomBot", "Unknown", "unknown"],
];

/** Picks one entry from a list of [weight, ...] tuples. */
export function pick(list) {
  let r = Math.random() * list.reduce((n, x) => n + x[0], 0);
  for (const x of list) if ((r -= x[0]) < 0) return x;
  return list[list.length - 1];
}

export const randomHash = () =>
  [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Parses "5:/,3:/blog,/about" into [[5,"/"],[3,"/blog"],[1,"/about"]]. */
export function parsePages(spec) {
  return spec.split(",").map((s) => {
    const m = s.trim().match(/^(\d+):(.+)$/);
    return m ? [Number(m[1]), m[2]] : [1, s.trim()];
  });
}

/**
 * Crawler events for the last `days` days: growing trend (1x to 2x), busier
 * during US/EU working hours, and a crawl burst about a week ago.
 */
export function generateHistory({ siteId, domain, pages, days = 30, now = Date.now() }) {
  const events = [];
  for (let h = days * 24; h >= 0; h--) {
    const at = now - h * 3_600_000;
    const trend = 1 + (days * 24 - h) / (days * 24);
    const diurnal = 0.6 + 0.8 * Math.max(0, Math.sin(((new Date(at).getUTCHours() - 6) / 24) * 2 * Math.PI));
    const burst = h > 160 && h < 175 ? 6 : 1;
    const n = Math.round(4 * trend * diurnal * burst * (0.6 + Math.random() * 0.8));
    for (let i = 0; i < n; i++) {
      const ts = at - Math.random() * 3_600_000;
      if (ts > now) continue;
      const [, user_agent, bot_name, platform, bot_type] = pick(BOTS);
      const [, page_path] = pick(pages);
      events.push({
        site_id: siteId,
        timestamp: new Date(ts).toISOString(),
        user_agent,
        bot_name,
        platform,
        bot_type,
        page_url: `https://${domain}${page_path}`,
        page_path,
        ip_hash: randomHash(),
      });
    }
  }
  return events;
}

/** Loads KEY=value lines into process.env without overriding what is already set. */
export function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no env file: rely on the environment
  }
}
