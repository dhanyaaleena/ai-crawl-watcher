import { BOT_TYPES, PLATFORMS, type BotType } from "../../supabase/functions/_shared/bots";

export type RangeKey = "24h" | "7d" | "30d";

export const RANGES: { key: RangeKey; label: string; short: string }[] = [
  { key: "24h", label: "Last 24 hours", short: "24h" },
  { key: "7d", label: "Last 7 days", short: "7d" },
  { key: "30d", label: "Last 30 days", short: "30d" },
];

export interface Filters {
  range: RangeKey;
  since: Date;
  until: Date;
  bucket: "hour" | "day";
  /** Bucket start instants covering [since, until), used to fill empty buckets. */
  buckets: Date[];
  platform: string | null;
  type: BotType | null;
  tz: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns URL search params into a concrete query window.
 * 24h = the current hour plus the 23 before it (hourly buckets).
 * 7d / 30d = today plus the 6 / 29 previous calendar days in the viewer's time zone (daily buckets).
 */
export function parseFilters(sp: SearchParams, tzInput?: string | null, now = new Date()): Filters {
  const tz = isValidTimeZone(tzInput) ? tzInput : "UTC";
  const rawRange = first(sp.range);
  const range: RangeKey = rawRange === "24h" || rawRange === "30d" ? rawRange : "7d";

  const rawPlatform = first(sp.platform);
  const platform = rawPlatform && PLATFORMS.includes(rawPlatform) ? rawPlatform : null;
  const rawType = first(sp.type);
  const type = BOT_TYPES.some((t) => t.value === rawType) ? (rawType as BotType) : null;

  const until = now;
  let since: Date;
  let buckets: Date[];
  if (range === "24h") {
    // Start of the current hour in the viewer's zone (differs from UTC for half-hour offsets like India).
    const hour = 3_600_000;
    const local = zonedDateParts(now, tz);
    const currentHour = Math.floor(now.getTime() / 1000) * 1000 - (local.minute * 60 + local.second) * 1000;
    buckets = Array.from({ length: 24 }, (_, i) => new Date(currentHour - (23 - i) * hour));
    since = buckets[0];
  } else {
    const days = range === "7d" ? 7 : 30;
    const today = zonedDateParts(now, tz);
    buckets = Array.from({ length: days }, (_, i) =>
      zonedMidnight(today.year, today.month, today.day - (days - 1 - i), tz),
    );
    since = buckets[0];
  }

  return { range, since, until, bucket: range === "24h" ? "hour" : "day", buckets, platform, type, tz };
}

/** Query-string for links that keep the current filters. */
export function filtersToQuery(f: Pick<Filters, "range" | "platform" | "type">): string {
  const q = new URLSearchParams();
  if (f.range !== "7d") q.set("range", f.range);
  if (f.platform) q.set("platform", f.platform);
  if (f.type) q.set("type", f.type);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Arguments shared by every analytics RPC. */
export function rpcArgs(siteId: string, f: Filters) {
  return {
    p_site_id: siteId,
    p_since: f.since.toISOString(),
    p_until: f.until.toISOString(),
    p_platform: f.platform,
    p_bot_type: f.type,
  };
}

// --- time zone helpers (no date library needed) ---------------------------

function zonedDateParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedDateParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant of local midnight for a calendar day in `tz` (day may overflow; Date.UTC normalises). */
export function zonedMidnight(year: number, month: number, day: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  // Second pass corrects for DST transitions between the guess and the result.
  t = guess - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}
