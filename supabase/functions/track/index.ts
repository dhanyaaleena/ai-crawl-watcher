// Tracking endpoint for AI crawler visits.
//
//   GET  /functions/v1/track?sid=<site_id>&u=<page_url>         -> tiny no-op script (snippet <script> tag)
//   GET  /functions/v1/track?sid=<site_id>&f=gif               -> 1x1 GIF (<noscript> fallback; page from Referer)
//   POST /functions/v1/track  {"sid": "...", "u": "...", "ip": "..."} -> 204 (sendBeacon / server-side forwarding)
//
// The User-Agent of the request itself is classified. Ordinary browsers are
// ignored; known AI crawlers and other bots ("Unknown") are stored.
//
// Each visit is also checked against the operator's published IP list
// (verify.ts). The IP is the connecting address (cf-connecting-ip, which the
// platform sets and callers cannot forge), or for server-side forwarding the
// crawler IP the site's server sends as "ip". Responses carry
// X-Track-Outcome and, when recorded, X-Track-Verification.

import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyUserAgent } from "../_shared/bots.ts";
import { anonymizeIp, clientIp, hostMatchesDomain, normalizePageUrl } from "../_shared/track-utils.ts";
import { createVerifier, parseIp, type Verification } from "../_shared/verify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IP_HASH_SALT = Deno.env.get("IP_HASH_SALT") ?? SERVICE_ROLE_KEY;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const verifier = createVerifier();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const SCRIPT = "/* ai-crawler-analytics */";

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Expose-Headers": "X-Track-Outcome, X-Track-Verification",
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

// Site id -> domain (or null when the site does not exist). Short TTL keeps
// lookups cheap on busy sites without serving stale deletes for long.
const siteCache = new Map<string, { domain: string | null; expires: number }>();
const SITE_TTL_MS = 60_000;

async function siteDomain(siteId: string): Promise<string | null> {
  const hit = siteCache.get(siteId);
  if (hit && hit.expires > Date.now()) return hit.domain;
  const { data, error } = await db.from("sites").select("domain").eq("id", siteId).maybeSingle();
  if (error) throw error;
  const domain = data?.domain ?? null;
  siteCache.set(siteId, { domain, expires: Date.now() + SITE_TTL_MS });
  return domain;
}

type Outcome = "recorded" | "ignored" | "rejected";
interface Result {
  outcome: Outcome;
  verification?: Verification;
}

async function record(req: Request, siteId: string | null, rawUrl: string | null, forwardedIp?: string | null): Promise<Result> {
  if (!siteId || !UUID.test(siteId)) return { outcome: "rejected" };

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 1000);
  const bot = classifyUserAgent(userAgent);
  if (!bot.isBot) return { outcome: "ignored" };

  const page = normalizePageUrl(rawUrl || req.headers.get("referer"));
  if (!page) return { outcome: "rejected" };

  const domain = await siteDomain(siteId);
  if (!domain || !hostMatchesDomain(page.host, domain)) return { outcome: "rejected" };

  // Server-side forwarding sends the crawler's IP; otherwise the crawler itself is connecting.
  const ip = (forwardedIp && parseIp(forwardedIp) ? forwardedIp.trim() : null) ?? clientIp(req.headers);
  const verification = await verifier.verify(bot.name, ip);
  const { error } = await db.from("crawler_events").insert({
    site_id: siteId,
    user_agent: userAgent || "(empty)",
    bot_name: bot.name,
    platform: bot.platform,
    bot_type: bot.type,
    page_url: page.url,
    page_path: page.path,
    ip_hash: ip ? await anonymizeIp(ip, siteId, IP_HASH_SALT) : null,
    verification,
  });
  if (error) throw error;
  return { outcome: "recorded", verification };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: BASE_HEADERS });

  let result: Result = { outcome: "rejected" };
  let wantsGif = false;
  const resultHeaders = () => ({
    "X-Track-Outcome": result.outcome,
    ...(result.verification ? { "X-Track-Verification": result.verification } : {}),
  });
  try {
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      wantsGif = params.get("f") === "gif";
      result = await record(req, params.get("sid"), params.get("u"));
    } else if (req.method === "POST") {
      // sendBeacon posts text/plain to avoid a CORS preflight, so parse manually.
      const body = JSON.parse((await req.text()) || "{}");
      const str = (v: unknown) => (typeof v === "string" ? v : null);
      result = await record(req, str(body.sid), str(body.u), str(body.ip));
      return new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...resultHeaders() } });
    } else {
      return new Response("Method not allowed", { status: 405, headers: BASE_HEADERS });
    }
  } catch (err) {
    // Never break the host page: log and still return a valid asset.
    console.error("track error", err);
  }

  const headers = { ...BASE_HEADERS, ...resultHeaders() };
  return wantsGif
    ? new Response(GIF, { headers: { ...headers, "Content-Type": "image/gif" } })
    : new Response(SCRIPT, { headers: { ...headers, "Content-Type": "application/javascript; charset=utf-8" } });
});
