import { describe, expect, it } from "vitest";
import { classifyUserAgent, PLATFORMS } from "../supabase/functions/_shared/bots";

// Real-world user agent strings as published by each vendor.
const UAS = {
  GPTBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  ChatGPTUser:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  OAISearch:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  PerplexityBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  GoogleExtended: "Mozilla/5.0 (compatible; Google-Extended/1.0)",
  MetaAgent: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  CCBot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  Bytespider: "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
};

describe("classifyUserAgent", () => {
  it.each([
    ["GPTBot", UAS.GPTBot, "OpenAI", "training"],
    ["ChatGPT-User", UAS.ChatGPTUser, "OpenAI", "assistant"],
    ["OAI-SearchBot", UAS.OAISearch, "OpenAI", "search"],
    ["ClaudeBot", UAS.ClaudeBot, "Anthropic", "training"],
    ["PerplexityBot", UAS.PerplexityBot, "Perplexity", "search"],
    ["Google-Extended", UAS.GoogleExtended, "Google", "training"],
    ["Meta-ExternalAgent", UAS.MetaAgent, "Meta", "training"],
    ["CCBot", UAS.CCBot, "Common Crawl", "training"],
    ["Bytespider", UAS.Bytespider, "ByteDance", "training"],
  ])("identifies %s", (name, ua, platform, type) => {
    expect(classifyUserAgent(ua)).toEqual({ isBot: true, name, platform, type });
  });

  it("flags non-AI bots as Unknown and keeps a readable name", () => {
    expect(classifyUserAgent(UAS.Googlebot)).toEqual({
      isBot: true,
      name: "Googlebot",
      platform: "Unknown",
      type: "unknown",
    });
    expect(classifyUserAgent("python-requests/2.32.3")).toMatchObject({ isBot: true, platform: "Unknown" });
    expect(classifyUserAgent("Mozilla/5.0 HeadlessChrome/120.0")).toMatchObject({ isBot: true, platform: "Unknown" });
  });

  it("identifies Gemini's user-triggered fetchers", () => {
    expect(classifyUserAgent("Google")).toEqual({ isBot: true, name: "Google (Gemini)", platform: "Google", type: "assistant" });
    expect(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/131.0.0.0 Safari/537.36")).toMatchObject({ name: "Google-Agent", platform: "Google", type: "assistant" });
    expect(classifyUserAgent("Google-NotebookLM")).toMatchObject({ name: "Google-GeminiNotebook", platform: "Google" });
    expect(classifyUserAgent("Google-GeminiNotebook")).toMatchObject({ name: "Google-GeminiNotebook", platform: "Google" });
    // Only the bare string, never a browser or Googlebot that mentions Google.
    expect(classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").name).toBe("Googlebot");
    expect(classifyUserAgent("Mozilla/5.0 Google Chrome").isBot).toBe(false);
  });

  it("treats an empty user agent as an unknown bot", () => {
    expect(classifyUserAgent("")).toMatchObject({ isBot: true, platform: "Unknown" });
    expect(classifyUserAgent(null)).toMatchObject({ isBot: true, platform: "Unknown" });
  });

  it("ignores ordinary browsers", () => {
    expect(classifyUserAgent(UAS.Chrome).isBot).toBe(false);
    expect(classifyUserAgent(UAS.Safari).isBot).toBe(false);
  });

  it("matches case-insensitively and with version suffixes", () => {
    expect(classifyUserAgent("gptbot/9.9").name).toBe("GPTBot");
    expect(classifyUserAgent("CLAUDEBOT").name).toBe("ClaudeBot");
  });

  it("lists every platform once with Unknown last", () => {
    expect(new Set(PLATFORMS).size).toBe(PLATFORMS.length);
    expect(PLATFORMS.at(-1)).toBe("Unknown");
  });
});
