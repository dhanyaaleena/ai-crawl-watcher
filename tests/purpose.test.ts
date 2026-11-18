import { describe, expect, it } from "vitest";
import { classifyUserAgent } from "../supabase/functions/_shared/bots";
import { parseFilters, previousFilters } from "../src/lib/filters";
import { purposeSplit } from "../src/lib/purpose";
import { TEST_BOT_UA } from "../src/lib/test-visit";

const rows = [
  { platform: "OpenAI", bot_name: "GPTBot", bot_type: "training", visits: 60 },
  { platform: "OpenAI", bot_name: "ChatGPT-User", bot_type: "assistant", visits: 15 },
  { platform: "OpenAI", bot_name: "OAI-SearchBot", bot_type: "search", visits: 5 },
  { platform: "Anthropic", bot_name: "ClaudeBot", bot_type: "training", visits: "20" },
  { platform: "Perplexity", bot_name: "PerplexityBot", bot_type: "search", visits: 30 },
  { platform: "Unknown", bot_name: "Googlebot", bot_type: "unknown", visits: 40 },
];

describe("purposeSplit", () => {
  const split = purposeSplit(rows);

  it("separates learning (training) from citing (search + assistant)", () => {
    expect(split.learning.visits).toBe(80);
    expect(split.citing.visits).toBe(50);
    expect(split.citing.search).toBe(35);
    expect(split.citing.assistant).toBe(15);
  });

  it("leaves Unknown bots out of the shares", () => {
    expect(split.unknown).toBe(40);
    expect(split.learning.share + split.citing.share).toBeCloseTo(1);
    expect(split.learning.share).toBeCloseTo(80 / 130);
  });

  it("ranks bots and platforms by visits", () => {
    expect(split.learning.topBots).toEqual(["GPTBot", "ClaudeBot"]);
    expect(split.citing.topBots).toEqual(["PerplexityBot", "ChatGPT-User", "OAI-SearchBot"]);
    expect(split.platforms).toEqual([
      { platform: "OpenAI", learning: 60, citing: 20 },
      { platform: "Perplexity", learning: 0, citing: 30 },
      { platform: "Anthropic", learning: 20, citing: 0 },
    ]);
    expect(split.platforms.some((p) => p.platform === "Unknown")).toBe(false);
  });

  it("states the split as a factual summary whose shares add to 100", () => {
    expect(split.takeaway).toBe(
      "62% of classified AI visits are for model training and 38% for search and answer retrieval.",
    );
    expect(purposeSplit([{ platform: "Perplexity", bot_name: "PerplexityBot", bot_type: "search", visits: 9 }]).takeaway).toBe(
      "0% of classified AI visits are for model training and 100% for search and answer retrieval.",
    );
    // 1/3 and 2/3 round to 33 + 67, never 33 + 66.
    expect(
      purposeSplit([
        { platform: "OpenAI", bot_name: "GPTBot", bot_type: "training", visits: 1 },
        { platform: "OpenAI", bot_name: "ChatGPT-User", bot_type: "assistant", visits: 2 },
      ]).takeaway,
    ).toMatch(/^33% .* 67% /);
  });

  it("handles no data", () => {
    const empty = purposeSplit([]);
    expect(empty.learning.share).toBe(0);
    expect(empty.takeaway).toBeNull();
    expect(purposeSplit([{ platform: "Unknown", bot_name: "curl", bot_type: "unknown", visits: 3 }]).takeaway).toBeNull();
  });
});

describe("previousFilters", () => {
  it("returns the same-length window right before", () => {
    const f = parseFilters({ range: "7d" }, "UTC", new Date("2026-03-10T15:30:00Z"));
    const p = previousFilters(f);
    expect(p.until.toISOString()).toBe(f.since.toISOString());
    expect(f.since.getTime() - p.since.getTime()).toBe(f.until.getTime() - f.since.getTime());
  });
});

describe("test visit", () => {
  it("is stored as an Unknown bot with a clear name, never as a real AI crawler", () => {
    expect(classifyUserAgent(TEST_BOT_UA)).toEqual({
      isBot: true,
      name: "Crawlwatch-TestBot",
      platform: "Unknown",
      type: "unknown",
    });
  });
});
