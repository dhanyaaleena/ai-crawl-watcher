import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone, rpcArgs, type Filters } from "@/lib/filters";
import { STACK_ORDER, stackKey } from "@/lib/platforms";

export interface Site {
  id: string;
  domain: string;
  created_at: string;
  /** Filled with generated demo data; the dashboard labels it "Sample data". */
  is_sample: boolean;
}

export const getSites = cache(async (): Promise<Site[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sites").select("id, domain, created_at, is_sample").order("created_at");
  if (error) throw error;
  return data;
});

export async function getSite(siteId: string): Promise<Site | null> {
  return (await getSites()).find((s) => s.id === siteId) ?? null;
}

/** Viewer's IANA time zone, set by <TimezoneSync /> in a cookie. */
export async function getTimezone(): Promise<string> {
  const tz = (await cookies()).get("tz")?.value;
  return tz && isValidTimeZone(decodeURIComponent(tz)) ? decodeURIComponent(tz) : "UTC";
}

export interface Overview {
  total_visits: number;
  previous_visits: number;
  active_bots: number;
  pages_crawled: number;
  top_platform: string | null;
  top_platform_visits: number | null;
  top_page: string | null;
  top_page_visits: number | null;
  last_seen: string | null;
}

export async function getOverview(siteId: string, f: Filters): Promise<Overview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawler_overview", rpcArgs(siteId, f)).single();
  if (error) throw error;
  return data as Overview;
}

export interface BotRow {
  platform: string;
  bot_name: string;
  bot_type: string;
  visits: number;
  pages: number;
  last_seen: string;
}

export async function getBotBreakdown(siteId: string, f: Filters): Promise<BotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawler_bot_breakdown", rpcArgs(siteId, f));
  if (error) throw error;
  return data as BotRow[];
}

export interface PlatformRow {
  platform: string;
  visits: number;
  bots: BotRow[];
}

export function groupByPlatform(rows: BotRow[]): PlatformRow[] {
  const map = new Map<string, PlatformRow>();
  for (const r of rows) {
    const p = map.get(r.platform) ?? { platform: r.platform, visits: 0, bots: [] };
    p.visits += Number(r.visits);
    p.bots.push(r);
    map.set(r.platform, p);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

export interface PageRow {
  page_path: string;
  page_url: string;
  visits: number;
  bots: number;
  platforms: string[];
  last_seen: string;
}

export async function getTopPages(siteId: string, f: Filters, limit = 100): Promise<PageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawler_top_pages", { ...rpcArgs(siteId, f), p_limit: limit });
  if (error) throw error;
  return data as PageRow[];
}

export interface TimeseriesPoint {
  t: number;
  total: number;
  [series: string]: number;
}

/** Visits per bucket, stacked by platform (long tail folded into "Other"), with empty buckets filled. */
export async function getTimeseries(siteId: string, f: Filters): Promise<{ points: TimeseriesPoint[]; series: string[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawler_timeseries", {
    ...rpcArgs(siteId, f),
    p_bucket: f.bucket,
    p_tz: f.tz,
  });
  if (error) throw error;

  const points = new Map<number, TimeseriesPoint>(f.buckets.map((b) => [b.getTime(), { t: b.getTime(), total: 0 }]));
  const present = new Set<string>();
  for (const row of data as { bucket: string; platform: string; visits: number }[]) {
    const point = points.get(new Date(row.bucket).getTime());
    if (!point) continue;
    const key = stackKey(row.platform);
    present.add(key);
    point[key] = (point[key] ?? 0) + Number(row.visits);
    point.total += Number(row.visits);
  }
  const series = STACK_ORDER.filter((k) => present.has(k));
  for (const p of points.values()) for (const s of series) p[s] ??= 0;
  return { points: [...points.values()], series };
}

export interface EventRow {
  id: string;
  timestamp: string;
  bot_name: string;
  platform: string;
  bot_type: string;
  page_path: string | null;
  page_url: string;
  user_agent: string;
}

const EVENT_COLUMNS = "id, timestamp, bot_name, platform, bot_type, page_path, page_url, user_agent";

export const ACTIVITY_PAGE_SIZE = 50;

export async function getActivity(
  siteId: string,
  f: Filters,
  opts: { page: number; q?: string | null },
): Promise<{ rows: EventRow[]; total: number }> {
  const supabase = await createClient();
  const from = (opts.page - 1) * ACTIVITY_PAGE_SIZE;
  let query = supabase
    .from("crawler_events")
    .select(EVENT_COLUMNS, { count: "exact" })
    .eq("site_id", siteId)
    .gte("timestamp", f.since.toISOString())
    .lt("timestamp", f.until.toISOString());
  if (f.platform) query = query.eq("platform", f.platform);
  if (f.type) query = query.eq("bot_type", f.type);
  if (opts.q) query = query.ilike("page_path", `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error, count } = await query
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + ACTIVITY_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data as EventRow[], total: count ?? 0 };
}

/** Most recent event for the site regardless of filters (install status). */
export async function getLastEvent(siteId: string): Promise<EventRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crawler_events")
    .select(EVENT_COLUMNS)
    .eq("site_id", siteId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EventRow | null;
}
