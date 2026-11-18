import { NextResponse, type NextRequest } from "next/server";
import { getRecentVisits, getSite } from "@/lib/queries";

/**
 * GET /api/recent?site=<id> -> the site's newest crawler visits (signed-in
 * owner only; row level security applies). Polled by the live crawl log.
 */
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get("site");
  const site = siteId ? await getSite(siteId) : null;
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const visits = await getRecentVisits(site.id);
  return NextResponse.json({ visits }, { headers: { "Cache-Control": "no-store" } });
}
