import { NextResponse, type NextRequest } from "next/server";
import { CSV_HEADER, csvLine } from "@/lib/csv";
import { parseFilters } from "@/lib/filters";
import { getSite, getTimezone } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const BATCH = 1000;
const COLUMNS = "id, timestamp, page_url, page_path, bot_name, platform, bot_type, user_agent, ip_hash, verification";

interface Row {
  id: string;
  timestamp: string;
  page_url: string;
  page_path: string | null;
  bot_name: string;
  platform: string;
  bot_type: string;
  user_agent: string;
  ip_hash: string | null;
  verification: string;
}

/**
 * GET /api/export?site=<id>[&range=24h|7d|30d&platform=..&type=..] -> CSV of matching events.
 * GET /api/export?site=<id>&all=1 -> every event for the site.
 * Streams in keyset-paginated batches (oldest first), so large exports never load fully in memory.
 */
export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const site = sp.site ? await getSite(sp.site) : null;
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const all = sp.all === "1";
  const f = parseFilters(sp, await getTimezone());
  const supabase = await createClient();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode("﻿" + CSV_HEADER)); // BOM so Excel reads UTF-8
      let cursor: { ts: string; id: string } | null = null;
      try {
        for (;;) {
          let q = supabase.from("crawler_events").select(COLUMNS).eq("site_id", site.id);
          if (!all) {
            q = q.gte("timestamp", f.since.toISOString()).lt("timestamp", f.until.toISOString());
            if (f.platform) q = q.eq("platform", f.platform);
            if (f.type) q = q.eq("bot_type", f.type);
          }
          if (cursor) q = q.or(`timestamp.gt."${cursor.ts}",and(timestamp.eq."${cursor.ts}",id.gt.${cursor.id})`);
          const { data, error } = await q.order("timestamp").order("id").limit(BATCH);
          if (error) throw error;
          const rows = data as Row[];
          if (rows.length) {
            controller.enqueue(
              enc.encode(
                rows
                  .map((r) =>
                    csvLine({
                      timestamp: new Date(r.timestamp).toISOString().replace(/\.\d{3}Z$/, "Z"),
                      page_url: r.page_url,
                      bot_name: r.bot_name,
                      platform: r.platform,
                      bot_type: r.bot_type,
                      user_agent: r.user_agent,
                      page_path: r.page_path,
                      ip_hash: r.ip_hash,
                      verification: r.verification,
                    }),
                  )
                  .join(""),
              ),
            );
          }
          if (rows.length < BATCH) break;
          const last = rows[rows.length - 1];
          cursor = { ts: last.timestamp, id: last.id };
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  const scope = all ? "all" : f.range;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crawlers-${site.domain}-${scope}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
