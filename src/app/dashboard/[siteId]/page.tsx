import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PlatformBars } from "@/components/platform-bars";
import { TimelineChart } from "@/components/timeline-chart";
import { filtersToQuery, RANGES } from "@/lib/filters";
import { changeVsPrevious, formatNumber, formatPercent, plural, timeAgo } from "@/lib/format";
import { getBotBreakdown, getOverview, getTimeseries, getTopPages, groupByPlatform } from "@/lib/queries";
import { loadSitePage } from "./_data";

export default async function OverviewPage({ params, searchParams }: PageProps<"/dashboard/[siteId]">) {
  const { site, filters: f } = await loadSitePage(params, searchParams);
  const [overview, bots, pages, timeline] = await Promise.all([
    getOverview(site.id, f),
    getBotBreakdown(site.id, f),
    getTopPages(site.id, f, 6),
    getTimeseries(site.id, f),
  ]);
  const platforms = groupByPlatform(bots);
  const total = Number(overview.total_visits);
  const change = changeVsPrevious(total, Number(overview.previous_visits));
  const rangeLabel = RANGES.find((r) => r.key === f.range)!.label.toLowerCase();
  const q = filtersToQuery(f);

  return (
    <>
      <PageHeader
        title={site.domain}
        description={overview.last_seen ? `Last crawler visit ${timeAgo(overview.last_seen)}` : "AI crawler activity"}
        siteId={site.id}
        filters={f}
      />

      {total === 0 ? (
        <EmptyState siteId={site.id} filtered={Boolean(f.platform || f.type)} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            <Stat label="Crawler visits" value={formatNumber(total)}>
              {change ? (
                <span className={`inline-flex items-center gap-0.5 ${change.direction === "down" ? "text-ink-2" : "text-good-ink"}`}>
                  {change.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  {change.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  {change.label}
                </span>
              ) : (
                <span>{rangeLabel}</span>
              )}
              {change && <span className="text-ink-3"> vs previous period</span>}
            </Stat>
            <Stat label="Active bots" value={formatNumber(overview.active_bots)}>
              across {formatNumber(platforms.length)} platform{platforms.length === 1 ? "" : "s"}
            </Stat>
            <Stat label="Top platform" value={overview.top_platform ?? "–"}>
              {formatPercent(Number(overview.top_platform_visits), total)} of visits
            </Stat>
            <Stat label="Top page" value={overview.top_page ?? "–"} mono>
              {plural(Number(overview.top_page_visits), "visit")} · {plural(Number(overview.pages_crawled), "page")} crawled
            </Stat>
          </div>

          <Card title="Crawler activity">
            <TimelineChart points={timeline.points} series={timeline.series} bucket={f.bucket} tz={f.tz} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Visits by platform" action={<ViewAll href={`/dashboard/${site.id}/platforms${q}`} />}>
              <PlatformBars rows={platforms} limit={7} />
            </Card>
            <Card title="Most crawled pages" action={<ViewAll href={`/dashboard/${site.id}/pages${q}`} />} flush>
              <ol className="divide-y divide-line border-t border-line">
                {pages.map((p) => (
                  <li key={p.page_path} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                    <span className="truncate font-mono text-[13px] text-ink-2" title={p.page_path}>{p.page_path}</span>
                    <span className="shrink-0 tabular-nums">{formatNumber(p.visits)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, children, mono }: { label: string; value: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`mt-1 truncate font-semibold tracking-tight ${mono ? "font-mono text-lg" : "text-2xl"}`} title={value}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-ink-3">{children}</div>
    </div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-xs text-accent-ink hover:underline">
      View all
    </Link>
  );
}
