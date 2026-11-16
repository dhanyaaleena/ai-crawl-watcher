// Shared AI crawler classification.
// Plain TypeScript with no runtime-specific imports, so the Deno edge function,
// the Next.js dashboard and the Vitest suite all use the same list.

export type BotType = "training" | "search" | "assistant" | "unknown";

export interface BotSignature {
  pattern: RegExp;
  name: string;
  platform: string;
  type: BotType;
}

export interface Classification {
  /** True when the user agent looks like any automated client. */
  isBot: boolean;
  name: string;
  platform: string;
  type: BotType;
}

/**
 * Known AI crawler signatures. Patterns match partial strings so version
 * suffixes ("GPTBot/1.2", "ClaudeBot/1.0; +claudebot@anthropic.com") still hit.
 * Order matters only where one token contains another; none currently do.
 */
export const BOT_SIGNATURES: BotSignature[] = [
  // OpenAI
  { pattern: /GPTBot/i, name: "GPTBot", platform: "OpenAI", type: "training" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", platform: "OpenAI", type: "assistant" },
  { pattern: /OAI-SearchBot/i, name: "OAI-SearchBot", platform: "OpenAI", type: "search" },
  // Anthropic
  { pattern: /ClaudeBot/i, name: "ClaudeBot", platform: "Anthropic", type: "training" },
  { pattern: /Claude-User/i, name: "Claude-User", platform: "Anthropic", type: "assistant" },
  { pattern: /Claude-SearchBot/i, name: "Claude-SearchBot", platform: "Anthropic", type: "search" },
  { pattern: /Claude-Web/i, name: "Claude-Web", platform: "Anthropic", type: "assistant" },
  { pattern: /anthropic-ai/i, name: "anthropic-ai", platform: "Anthropic", type: "training" },
  // Google
  { pattern: /Google-Extended/i, name: "Google-Extended", platform: "Google", type: "training" },
  { pattern: /Google-CloudVertexBot/i, name: "Google-CloudVertexBot", platform: "Google", type: "assistant" },
  { pattern: /Gemini-Deep-Research/i, name: "Gemini-Deep-Research", platform: "Google", type: "assistant" },
  // Perplexity
  { pattern: /PerplexityBot/i, name: "PerplexityBot", platform: "Perplexity", type: "search" },
  { pattern: /Perplexity-User/i, name: "Perplexity-User", platform: "Perplexity", type: "assistant" },
  // Meta
  { pattern: /Meta-ExternalAgent/i, name: "Meta-ExternalAgent", platform: "Meta", type: "training" },
  { pattern: /Meta-ExternalFetcher/i, name: "Meta-ExternalFetcher", platform: "Meta", type: "assistant" },
  { pattern: /FacebookBot/i, name: "FacebookBot", platform: "Meta", type: "training" },
  // Apple
  { pattern: /Applebot-Extended/i, name: "Applebot-Extended", platform: "Apple", type: "training" },
  // Common Crawl
  { pattern: /CCBot/i, name: "CCBot", platform: "Common Crawl", type: "training" },
  // ByteDance
  { pattern: /Bytespider/i, name: "Bytespider", platform: "ByteDance", type: "training" },
  // Amazon
  { pattern: /Amazonbot/i, name: "Amazonbot", platform: "Amazon", type: "search" },
  // Mistral
  { pattern: /MistralAI-User/i, name: "MistralAI-User", platform: "Mistral", type: "assistant" },
  // Cohere
  { pattern: /cohere-training-data-crawler/i, name: "cohere-training-data-crawler", platform: "Cohere", type: "training" },
  { pattern: /cohere-ai/i, name: "cohere-ai", platform: "Cohere", type: "assistant" },
  // DuckDuckGo
  { pattern: /DuckAssistBot/i, name: "DuckAssistBot", platform: "DuckDuckGo", type: "search" },
  // You.com
  { pattern: /YouBot/i, name: "YouBot", platform: "You.com", type: "search" },
  // Allen Institute for AI
  { pattern: /AI2Bot/i, name: "AI2Bot", platform: "AI2", type: "training" },
  // Diffbot
  { pattern: /Diffbot/i, name: "Diffbot", platform: "Diffbot", type: "training" },
  // Timpi
  { pattern: /Timpibot/i, name: "Timpibot", platform: "Timpi", type: "training" },
];

/** Signals that a user agent belongs to some automated client. */
const GENERIC_BOT =
  /bot\b|bot\/|crawl|spider|slurp|scrape|headless|phantomjs|puppeteer|playwright|selenium|python-requests|python-urllib|httpx|aiohttp|scrapy|curl\/|wget\/|go-http-client|node-fetch|axios\/|okhttp|java\/|libwww|ia_archiver|facebookexternalhit|feedfetcher|^$/i;

/** Pulls a readable product token ("Googlebot", "SemrushBot") out of an unknown bot UA. */
const BOT_TOKEN = /([A-Za-z][\w.-]*(?:bot|crawler|spider|fetcher|scraper))\b/i;

export const UNKNOWN: Classification = {
  isBot: true,
  name: "Unknown",
  platform: "Unknown",
  type: "unknown",
};

export const HUMAN: Classification = {
  isBot: false,
  name: "",
  platform: "",
  type: "unknown",
};

export function classifyUserAgent(userAgent: string | null | undefined): Classification {
  const ua = (userAgent ?? "").trim();
  if (!ua) return UNKNOWN;

  for (const bot of BOT_SIGNATURES) {
    if (bot.pattern.test(ua)) {
      return { isBot: true, name: bot.name, platform: bot.platform, type: bot.type };
    }
  }

  if (GENERIC_BOT.test(ua)) {
    const token = ua.match(BOT_TOKEN)?.[1];
    return { ...UNKNOWN, name: token ? token.slice(0, 100) : "Unknown" };
  }

  return HUMAN;
}

/** Distinct platform names, in list order, plus "Unknown". */
export const PLATFORMS: string[] = [
  ...new Set(BOT_SIGNATURES.map((b) => b.platform)),
  "Unknown",
];

export const BOT_TYPES: { value: BotType; label: string }[] = [
  { value: "training", label: "AI Training" },
  { value: "search", label: "AI Search" },
  { value: "assistant", label: "AI Assistant" },
  { value: "unknown", label: "Unknown" },
];
