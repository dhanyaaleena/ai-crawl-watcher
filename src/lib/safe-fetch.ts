import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/**
 * Server-side fetch of a page on a customer's domain, safe against SSRF.
 *
 * `fetch` with `redirect: "follow"` only lets us check the first hostname: a
 * redirect, or a DNS record, can still point at an internal address. Here every
 * hop is followed by hand, and the address check runs inside the socket's own
 * DNS lookup, so the IP that is checked is the IP that is connected to (no
 * window for DNS rebinding between a check and the request).
 */

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64: embeds an IPv4 address we can't vet here
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv6");
}

/** True for addresses on the public internet; false for private, loopback, link-local and reserved ranges. */
export function isPublicAddress(address: string): boolean {
  const v4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1]; // IPv4-mapped IPv6
  if (v4) return !BLOCKED.check(v4, "ipv4");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) return !BLOCKED.check(address, "ipv4");
  if (address.includes(":")) return !BLOCKED.check(address, "ipv6");
  return false;
}

function guardedLookup(allow: (address: string) => boolean): LookupFunction {
  const lookup = (
    hostname: string,
    options: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void,
  ) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      if (!addresses.length || addresses.some((a) => !allow(a.address))) {
        return callback(Object.assign(new Error(`${hostname} resolves to a private or reserved address`), { code: "EPRIVATEADDR" }));
      }
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    });
  };
  return lookup as unknown as LookupFunction;
}

interface Hop {
  status: number;
  location?: string;
  body: string;
}

function get(url: URL, headers: Record<string, string>, signal: AbortSignal, maxBytes: number, lookup: LookupFunction): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, { headers: { ...headers, "accept-encoding": "identity" }, signal, lookup }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, location: res.headers.location, body: "" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const done = () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") });
      res.on("data", (chunk: Buffer) => {
        if (size >= maxBytes) return;
        chunks.push(chunk);
        size += chunk.length;
        if (size >= maxBytes) res.destroy(); // enough to look for the snippet
      });
      res.on("end", done);
      res.on("close", done);
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

export async function fetchPublicPage(
  start: string,
  {
    headers = {},
    timeoutMs = 8000,
    maxBytes = 3_000_000,
    maxRedirects = 3,
    /** Which resolved addresses may be connected to. Tests override this. */
    allowAddress = isPublicAddress,
  }: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    allowAddress?: (address: string) => boolean;
  } = {},
): Promise<{ status: number; url: string; body: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  const lookup = guardedLookup(allowAddress);
  let url = new URL(start);
  for (let hop = 0; ; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`refusing a ${url.protocol} URL`);
    if (url.username || url.password) throw new Error("refusing a URL with credentials");
    // Node connects to IP-literal hosts without calling `lookup`, so vet those here.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !allowAddress(literal)) throw new Error(`${literal} is a private or reserved address`);
    const res = await get(url, headers, signal, maxBytes, lookup);
    if (res.location !== undefined) {
      if (hop >= maxRedirects) throw new Error(`more than ${maxRedirects} redirects`);
      url = new URL(res.location, url);
      continue;
    }
    return { status: res.status, url: url.toString(), body: res.body };
  }
}
