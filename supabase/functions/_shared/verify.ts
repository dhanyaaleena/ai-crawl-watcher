// Crawler verification: a user agent can claim to be GPTBot, but only OpenAI's
// servers use OpenAI's published IP addresses. Each visit's IP is checked
// against the operator's official list before the IP is hashed and discarded.
//
// Plain TypeScript (fetch + BigInt only), shared by the Deno edge function and
// the Vitest suite.

export type Verification = "verified" | "unverified" | "unchecked";

/** Official IP lists, all in the same {"prefixes":[{"ipv4Prefix"|"ipv6Prefix"}]} format. */
export const IP_LISTS: Record<string, string[]> = {
  "openai-gptbot": ["https://openai.com/gptbot.json"],
  "openai-searchbot": ["https://openai.com/searchbot.json"],
  "openai-chatgpt-user": ["https://openai.com/chatgpt-user.json"],
  anthropic: ["https://claude.com/crawling/bots.json"],
  "perplexity-bot": ["https://www.perplexity.com/perplexitybot.json"],
  "perplexity-user": ["https://www.perplexity.com/perplexity-user.json"],
  google: [
    "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
    "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json",
    "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json",
    "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
  ],
  apple: ["https://search.developer.apple.com/applebot.json"],
  commoncrawl: ["https://index.commoncrawl.org/ccbot.json"],
  duckduckgo: ["https://duckduckgo.com/duckassistbot.json"],
};

/**
 * Bot name (as in bots.ts) -> IP list. Bots without an official list (Meta,
 * ByteDance, Amazon, Mistral, Cohere, …) and Unknown bots are "unchecked".
 */
export const BOT_IP_LIST: Record<string, keyof typeof IP_LISTS> = {
  GPTBot: "openai-gptbot",
  "OAI-SearchBot": "openai-searchbot",
  "ChatGPT-User": "openai-chatgpt-user",
  ClaudeBot: "anthropic",
  "Claude-User": "anthropic",
  "Claude-SearchBot": "anthropic",
  "Claude-Web": "anthropic",
  "anthropic-ai": "anthropic",
  PerplexityBot: "perplexity-bot",
  "Perplexity-User": "perplexity-user",
  "Google-Extended": "google",
  "Google-CloudVertexBot": "google",
  "Gemini-Deep-Research": "google",
  "Applebot-Extended": "apple",
  CCBot: "commoncrawl",
  DuckAssistBot: "duckduckgo",
};

export const isVerifiable = (botName: string): boolean => botName in BOT_IP_LIST;

// ---------------------------------------------------------------------------
// IP parsing and CIDR matching
// (BigInt() calls rather than bigint literals: the app's tsconfig targets ES2017.)

export interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

export function parseIp(input: string | null | undefined): ParsedIp | null {
  if (!input) return null;
  const s = input.trim().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return parseIp(mapped[1]);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
    const parts = s.split(".").map(Number);
    if (parts.some((p) => p > 255)) return null;
    return { version: 4, value: parts.reduce((n, p) => (n << BigInt(8)) | BigInt(p), BigInt(0)) };
  }
  if (!s.includes(":")) return null;
  return parseIpv6(s);
}

function parseIpv6(s: string): ParsedIp | null {
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    const items = part.split(":");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i === items.length - 1 && item.includes(".")) {
        const v4 = parseIp(item);
        if (!v4 || v4.version !== 4) return null;
        out.push(Number(v4.value >> BigInt(16)), Number(v4.value & BigInt(0xffff)));
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(item)) return null;
        out.push(parseInt(item, 16));
      }
    }
    return out;
  };
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array(Math.max(0, missing)).fill(0), ...tail];
  return { version: 6, value: groups.reduce((n, g) => (n << BigInt(16)) | BigInt(g), BigInt(0)) };
}

export interface Cidr {
  version: 4 | 6;
  base: bigint;
  mask: bigint;
}

export function parseCidr(cidr: string): Cidr | null {
  const [addr, bitsRaw] = cidr.trim().split("/");
  const ip = parseIp(addr);
  if (!ip) return null;
  const width = ip.version === 4 ? 32 : 128;
  const bits = bitsRaw === undefined ? width : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return null;
  const all = (BigInt(1) << BigInt(width)) - BigInt(1);
  const mask = bits === 0 ? BigInt(0) : (all << BigInt(width - bits)) & all;
  return { version: ip.version, base: ip.value & mask, mask };
}

export function ipInCidrs(ip: ParsedIp, cidrs: Cidr[]): boolean {
  return cidrs.some((c) => c.version === ip.version && (ip.value & c.mask) === c.base);
}

/** Reads the CIDRs out of an official list file; ignores anything malformed. */
export function parsePrefixList(json: unknown): Cidr[] {
  const prefixes = (json as { prefixes?: unknown })?.prefixes;
  if (!Array.isArray(prefixes)) return [];
  const out: Cidr[] = [];
  for (const p of prefixes) {
    const raw = (p as { ipv4Prefix?: unknown; ipv6Prefix?: unknown })?.ipv4Prefix ?? (p as { ipv6Prefix?: unknown })?.ipv6Prefix;
    const cidr = typeof raw === "string" ? parseCidr(raw) : null;
    if (cidr) out.push(cidr);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verifier with an in-memory cache of the lists

export interface VerifierOptions {
  fetch?: typeof fetch;
  /** How long a downloaded list is trusted. */
  ttlMs?: number;
  /** After a failed download, how long to wait before trying again. */
  retryMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

export function createVerifier(opts: VerifierOptions = {}) {
  const doFetch = opts.fetch ?? fetch;
  const ttl = opts.ttlMs ?? 6 * 3_600_000;
  const retry = opts.retryMs ?? 5 * 60_000;
  const timeout = opts.timeoutMs ?? 3_000;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { cidrs: Cidr[] | null; expires: number; pending?: Promise<Cidr[] | null> }>();

  async function download(listId: string): Promise<Cidr[] | null> {
    try {
      const lists = await Promise.all(
        IP_LISTS[listId].map(async (url) => {
          const res = await doFetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: "application/json" } });
          if (!res.ok) throw new Error(`${url}: ${res.status}`);
          return parsePrefixList(await res.json());
        }),
      );
      const cidrs = lists.flat();
      return cidrs.length ? cidrs : null;
    } catch (err) {
      console.error("ip list download failed", listId, err);
      return null;
    }
  }

  async function list(listId: string): Promise<Cidr[] | null> {
    const hit = cache.get(listId);
    if (hit?.pending) return hit.pending;
    if (hit && hit.expires > now()) return hit.cidrs;
    const pending = download(listId).then((cidrs) => {
      // Keep serving the last good list if a refresh fails.
      const kept = cidrs ?? hit?.cidrs ?? null;
      cache.set(listId, { cidrs: kept, expires: now() + (cidrs ? ttl : retry) });
      return kept;
    });
    cache.set(listId, { cidrs: hit?.cidrs ?? null, expires: 0, pending });
    return pending;
  }

  return {
    /**
     * "verified": the IP is on the operator's list. "unverified": the bot has a
     * list and the IP is not on it. "unchecked": no list exists for this bot,
     * no IP was available, or the list could not be downloaded.
     */
    async verify(botName: string, ip: string | null | undefined): Promise<Verification> {
      const listId = BOT_IP_LIST[botName];
      const parsed = parseIp(ip);
      if (!listId || !parsed) return "unchecked";
      const cidrs = await list(listId);
      if (!cidrs) return "unchecked";
      return ipInCidrs(parsed, cidrs) ? "verified" : "unverified";
    },
  };
}
