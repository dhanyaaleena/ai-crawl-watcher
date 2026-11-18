import { describe, expect, it, vi } from "vitest";
import { BOT_SIGNATURES } from "../supabase/functions/_shared/bots";
import {
  BOT_IP_LIST,
  createVerifier,
  IP_LISTS,
  ipInCidrs,
  parseCidr,
  parseIp,
  parsePrefixList,
} from "../supabase/functions/_shared/verify";

const cidrs = (...list: string[]) => list.map((c) => parseCidr(c)!);
const inList = (ip: string, ...list: string[]) => ipInCidrs(parseIp(ip)!, cidrs(...list));

describe("IP parsing and CIDR matching", () => {
  it("matches IPv4 ranges at their edges", () => {
    expect(inList("132.196.86.0", "132.196.86.0/24")).toBe(true);
    expect(inList("132.196.86.255", "132.196.86.0/24")).toBe(true);
    expect(inList("132.196.87.0", "132.196.86.0/24")).toBe(false);
    expect(inList("172.182.202.127", "172.182.202.0/25")).toBe(true);
    expect(inList("172.182.202.128", "172.182.202.0/25")).toBe(false);
    expect(inList("18.97.9.100", "18.97.9.100/32")).toBe(true);
    expect(inList("18.97.9.101", "18.97.9.100/32")).toBe(false);
  });

  it("matches IPv6 ranges, including compressed forms", () => {
    expect(inList("2001:4860:4801:10::1", "2001:4860:4801:10::/64")).toBe(true);
    expect(inList("2001:4860:4801:10:ffff:ffff:ffff:ffff", "2001:4860:4801:10::/64")).toBe(true);
    expect(inList("2001:4860:4801:11::1", "2001:4860:4801:10::/64")).toBe(false);
    expect(inList("2600:1f28:365:80ff::9", "2600:1f28:365:8000::/56")).toBe(true);
  });

  it("treats IPv4-mapped IPv6 as IPv4 and never mixes versions", () => {
    expect(inList("::ffff:132.196.86.5", "132.196.86.0/24")).toBe(true);
    expect(inList("2001:db8::1", "0.0.0.0/0")).toBe(false);
    expect(inList("10.0.0.1", "::/0")).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "256.1.1.1", "1.2.3", "abc", "1:2:3:4:5:6:7:8:9", "1::2::3", "gggg::1"]) {
      expect(parseIp(bad)).toBeNull();
    }
    expect(parseCidr("10.0.0.0/33")).toBeNull();
    expect(parseCidr("10.0.0.0/x")).toBeNull();
  });

  it("reads the official list format and skips junk", () => {
    const list = parsePrefixList({
      creationTime: "2026-11-01T00:00:00Z",
      prefixes: [{ ipv4Prefix: "20.0.0.0/8" }, { ipv6Prefix: "2001:db8::/32" }, { ipv4Prefix: "nope" }, {}, null],
    });
    expect(list).toHaveLength(2);
    expect(parsePrefixList({})).toEqual([]);
    expect(parsePrefixList(null)).toEqual([]);
  });
});

describe("bot to list mapping", () => {
  it("only maps bots that exist in the classifier, to lists that exist", () => {
    const names = new Set(BOT_SIGNATURES.map((b) => b.name));
    for (const [bot, list] of Object.entries(BOT_IP_LIST)) {
      expect(names.has(bot), bot).toBe(true);
      expect(IP_LISTS[list], list).toBeDefined();
    }
  });

  it("matches the demo scripts' list of verifiable bots", async () => {
    const { VERIFIABLE } = await import("../scripts/lib/demo-traffic.mjs");
    const scriptBots = [...(VERIFIABLE as Set<string>)].sort();
    const sharedBots = Object.keys(BOT_IP_LIST).filter((b) => !["Claude-Web", "anthropic-ai", "Google-CloudVertexBot", "Gemini-Deep-Research"].includes(b));
    expect(scriptBots).toEqual(sharedBots.sort());
  });

  it("covers the main AI crawlers", () => {
    for (const bot of ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "PerplexityBot", "Perplexity-User"]) {
      expect(BOT_IP_LIST[bot], bot).toBeDefined();
    }
  });
});

describe("createVerifier", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  const openai = { prefixes: [{ ipv4Prefix: "132.196.86.0/24" }] };

  it("verifies listed IPs and flags unlisted ones", async () => {
    const fetch = vi.fn(async () => json(openai));
    const v = createVerifier({ fetch });
    expect(await v.verify("GPTBot", "132.196.86.10")).toBe("verified");
    expect(await v.verify("GPTBot", "203.0.113.7")).toBe("unverified");
    expect(fetch).toHaveBeenCalledTimes(1); // cached
  });

  it("leaves bots without a list, unknown bots and missing IPs unchecked", async () => {
    const fetch = vi.fn(async () => json(openai));
    const v = createVerifier({ fetch });
    expect(await v.verify("Bytespider", "132.196.86.10")).toBe("unchecked");
    expect(await v.verify("Googlebot", "132.196.86.10")).toBe("unchecked");
    expect(await v.verify("GPTBot", null)).toBe("unchecked");
    expect(await v.verify("GPTBot", "not-an-ip")).toBe("unchecked");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never calls a visit unverified when the list can't be downloaded", async () => {
    const v = createVerifier({ fetch: async () => new Response("down", { status: 503 }) });
    expect(await v.verify("GPTBot", "203.0.113.7")).toBe("unchecked");
    const thrown = createVerifier({ fetch: async () => Promise.reject(new Error("timeout")) });
    expect(await thrown.verify("GPTBot", "203.0.113.7")).toBe("unchecked");
  });

  it("downloads each list once for concurrent visits", async () => {
    const fetch = vi.fn(async () => json(openai));
    const v = createVerifier({ fetch });
    await Promise.all([v.verify("GPTBot", "132.196.86.1"), v.verify("GPTBot", "132.196.86.2"), v.verify("GPTBot", "1.1.1.1")]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes after the TTL and keeps the last good list if a refresh fails", async () => {
    let t = 0;
    let fail = false;
    const fetch = vi.fn(async () => (fail ? new Response("", { status: 500 }) : json(openai)));
    const v = createVerifier({ fetch, now: () => t, ttlMs: 1000 });
    expect(await v.verify("GPTBot", "132.196.86.1")).toBe("verified");
    t = 2000;
    fail = true;
    expect(await v.verify("GPTBot", "132.196.86.1")).toBe("verified");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("merges every file of a multi-file list (Google)", async () => {
    const fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("googlebot") ? json({ prefixes: [{ ipv6Prefix: "2001:4860:4801:10::/64" }] }) : json({ prefixes: [{ ipv4Prefix: "66.249.64.0/27" }] }),
    );
    const v = createVerifier({ fetch });
    expect(await v.verify("Google-Extended", "2001:4860:4801:10::5")).toBe("verified");
    expect(await v.verify("Google-Extended", "66.249.64.3")).toBe("verified");
    expect(fetch).toHaveBeenCalledTimes(IP_LISTS.google.length);
  });
});
