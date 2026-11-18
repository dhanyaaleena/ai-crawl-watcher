import { describe, expect, it } from "vitest";
import { CSV_HEADER, csvCell, csvLine } from "../src/lib/csv";
import { filtersToQuery, parseFilters, zonedMidnight } from "../src/lib/filters";
import { changeVsPrevious, formatPercent } from "../src/lib/format";
import { platformColor, stackKey } from "../src/lib/platforms";
import { headSnippet } from "../src/lib/snippet";

describe("CSV", () => {
  it("uses the PRD column order first", () => {
    expect(CSV_HEADER.startsWith("timestamp,page_url,bot_name,platform,bot_type,user_agent")).toBe(true);
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Mozilla/5.0 (KHTML, like Gecko) "x"')).toBe('"Mozilla/5.0 (KHTML, like Gecko) ""x"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas in attacker-controlled fields", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("ends lines with CRLF", () => {
    const line = csvLine({
      timestamp: "2026-01-31T10:23:45Z",
      page_url: "https://example.com/blog/post-1",
      bot_name: "GPTBot",
      platform: "OpenAI",
      bot_type: "training",
      user_agent: "GPTBot/1.2",
      page_path: "/blog/post-1",
      ip_hash: null,
      verification: "verified",
    });
    expect(line).toBe("2026-01-31T10:23:45Z,https://example.com/blog/post-1,GPTBot,OpenAI,training,GPTBot/1.2,/blog/post-1,,verified\r\n");
  });
});

describe("parseFilters", () => {
  const now = new Date("2026-03-10T15:30:00Z");

  it("defaults to 7 calendar days and ignores invalid values", () => {
    const f = parseFilters({ range: "1y", platform: "Nope", type: "evil" }, "UTC", now);
    expect(f.range).toBe("7d");
    expect(f.platform).toBeNull();
    expect(f.type).toBeNull();
    expect(f.buckets).toHaveLength(7);
    expect(f.since.toISOString()).toBe("2026-03-04T00:00:00.000Z");
    expect(f.bucket).toBe("day");
  });

  it("uses 24 hourly buckets ending at the current hour", () => {
    const f = parseFilters({ range: "24h" }, "UTC", now);
    expect(f.buckets).toHaveLength(24);
    expect(f.buckets.at(-1)!.toISOString()).toBe("2026-03-10T15:00:00.000Z");
    expect(f.bucket).toBe("hour");
  });

  it("aligns hourly buckets to local hours for half-hour offsets", () => {
    const f = parseFilters({ range: "24h" }, "Asia/Kolkata", now); // 21:00 IST
    expect(f.buckets.at(-1)!.toISOString()).toBe("2026-03-10T15:30:00.000Z");
    expect(f.buckets[0].toISOString()).toBe("2026-03-09T16:30:00.000Z");
  });

  it("aligns day buckets to midnight in the viewer's time zone", () => {
    const f = parseFilters({ range: "30d" }, "America/New_York", now);
    expect(f.buckets).toHaveLength(30);
    // 10 Mar 2026 in New York is EDT (UTC-4) after the 8 Mar DST change.
    expect(f.buckets.at(-1)!.toISOString()).toBe("2026-03-10T04:00:00.000Z");
    // 9 Feb is still EST (UTC-5).
    expect(f.buckets[0].toISOString()).toBe("2026-02-09T05:00:00.000Z");
  });

  it("falls back to UTC for an invalid time zone", () => {
    expect(parseFilters({}, "Mars/Olympus", now).tz).toBe("UTC");
  });

  it("accepts known platforms and bot types", () => {
    const f = parseFilters({ platform: "Anthropic", type: "search" }, "UTC", now);
    expect(f.platform).toBe("Anthropic");
    expect(f.type).toBe("search");
    expect(filtersToQuery(f)).toBe("?platform=Anthropic&type=search");
  });

  it("zonedMidnight handles Asia/Kolkata half-hour offsets", () => {
    expect(zonedMidnight(2026, 1, 31, "Asia/Kolkata").toISOString()).toBe("2026-01-30T18:30:00.000Z");
  });
});

describe("platform colours", () => {
  it("are fixed per platform and fold the long tail into Other", () => {
    expect(platformColor("OpenAI")).toBe("var(--series-1)");
    expect(platformColor("Anthropic")).toBe("var(--series-2)");
    expect(platformColor("Amazon")).toBe("var(--series-other)");
    expect(stackKey("Unknown")).toBe("Other");
  });
});

describe("formatting", () => {
  it("compares with the previous period", () => {
    expect(changeVsPrevious(150, 100)).toEqual({ label: "+50%", direction: "up" });
    expect(changeVsPrevious(50, 100)).toEqual({ label: "-50%", direction: "down" });
    expect(changeVsPrevious(10, 0)).toBeNull();
    expect(formatPercent(1, 1000)).toBe("<1%");
  });
});

describe("tracking snippet", () => {
  it("stays well under the 5 KB budget and embeds the site id", () => {
    const s = headSnippet("8f9e3c1a-0000-4000-8000-000000000000", "https://abc.supabase.co/functions/v1/track");
    expect(new TextEncoder().encode(s).length).toBeLessThan(5 * 1024);
    expect(s).toContain("8f9e3c1a-0000-4000-8000-000000000000");
    expect(s).toContain("g.async=1");
  });
});
