// Runtime-neutral helpers for the tracking endpoint (Deno and Node 20+ both
// provide URL and Web Crypto), kept separate so they can be unit tested.

export interface NormalizedPage {
  /** origin + pathname; query string and fragment are dropped (they often carry tokens or PII). */
  url: string;
  path: string;
  host: string;
}

export function normalizePageUrl(raw: string | null | undefined): NormalizedPage | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const path = (decodeSafe(u.pathname) || "/").slice(0, 500);
  return { url: `${u.origin}${u.pathname}`.slice(0, 2000), path, host: u.hostname.toLowerCase() };
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Normalises user input like "https://www.Example.com/blog" to "example.com". */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/:\d+$/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\.$/, "");
  return s;
}

/** True when host is the site's domain or one of its subdomains (www. ignored). */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const d = domain.toLowerCase().replace(/^www\./, "");
  return h === d || h.endsWith(`.${d}`);
}

/** True for a plain IPv4 or IPv6 address (used to accept a forwarded crawler IP). */
export function isIpAddress(value: string): boolean {
  const s = value.trim();
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((p) => Number(p) <= 255);
  return s.length <= 45 && /^[0-9a-f:.]+$/i.test(s) && (s.match(/:/g)?.length ?? 0) >= 2;
}

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    headers.get("cf-connecting-ip") ??
    (forwarded ? forwarded.split(",")[0] : null) ??
    headers.get("x-real-ip");
  return ip?.trim() || null;
}

/**
 * Truncates the IP (IPv4 /24, IPv6 /48) and hashes it with a secret salt and
 * the site id. Truncation means the hash cannot be reversed to an exact
 * address even if the salt leaks; the site id stops cross-site correlation.
 */
export async function anonymizeIp(ip: string, siteId: string, salt: string): Promise<string> {
  const truncated = truncateIp(ip);
  const bytes = new TextEncoder().encode(`${salt}|${siteId}|${truncated}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function truncateIp(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return truncateIp(mapped[1]);
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
  }
  if (ip.includes(":")) {
    const groups = ip.split("::")[0].split(":").filter(Boolean);
    return `${groups.slice(0, 3).join(":")}::`;
  }
  return ip;
}
