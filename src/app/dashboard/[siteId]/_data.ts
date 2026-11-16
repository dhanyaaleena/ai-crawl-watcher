import "server-only";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/filters";
import { getSite, getTimezone } from "@/lib/queries";

/** Resolves the site (404 if it isn't the user's) and the filters for a site page. */
export async function loadSitePage(
  params: Promise<{ siteId: string }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
) {
  const [{ siteId }, sp, tz] = await Promise.all([params, searchParams, getTimezone()]);
  const site = await getSite(siteId);
  if (!site) notFound();
  return { site, filters: parseFilters(sp, tz), sp };
}
