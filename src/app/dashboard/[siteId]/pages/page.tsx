import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { SampleDataTag } from "@/components/badges";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import { platformColor } from "@/lib/platforms";
import { getTopPages } from "@/lib/queries";
import { loadSitePage } from "../_data";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/pages">) {
  const { site, filters: f } = await loadSitePage(params, searchParams);
  const pages = await getTopPages(site.id, f, 100);
  const max = Number(pages[0]?.visits ?? 0);

  return (
    <>
      <PageHeader
        title="Pages"
        description="Pages ranked by how often AI crawlers fetched them (top 100)."
        siteId={site.id}
        filters={f} badge={site.is_sample ? <SampleDataTag /> : undefined} />
      {pages.length === 0 ? (
        <EmptyState siteId={site.id} filtered={Boolean(f.platform || f.type)} />
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm sm:min-w-[520px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="w-11 py-2 pl-5 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="w-20 px-3 py-2 text-right font-medium sm:w-36 sm:text-left xl:w-44">Visits</th>
                  <th className="hidden w-14 px-3 py-2 text-right font-medium sm:table-cell">Bots</th>
                  <th className="hidden w-28 px-3 py-2 font-medium lg:table-cell">Platforms</th>
                  <th className="hidden w-36 py-2 pr-5 pl-3 text-right font-medium md:table-cell">Last crawled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pages.map((p, i) => (
                  <tr key={p.page_path}>
                    <td className="py-2.5 pl-5 tabular-nums text-ink-3">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <a
                        href={p.page_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group flex items-center gap-1.5 font-mono text-[13px] text-ink hover:text-accent-ink"
                        title={p.page_url}
                      >
                        <span className="truncate">{p.page_path}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" aria-hidden="true" />
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-full shrink-0 text-right tabular-nums sm:w-11">{formatNumber(p.visits)}</span>
                        <span className="hidden h-1.5 flex-1 rounded-full bg-surface-2 sm:block" aria-hidden="true">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${(Number(p.visits) / max) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{formatNumber(p.bots)}</td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      <span className="flex items-center gap-1" title={p.platforms.join(", ")}>
                        <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                          {[...new Set(p.platforms.map(platformColor))].map((color) => (
                            <span key={color} className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                          ))}
                        </span>
                        <span className="ml-1 shrink-0 text-xs tabular-nums text-ink-3">
                          {p.platforms.length === 1 ? "" : p.platforms.length}
                        </span>
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-5 pl-3 text-right text-ink-2 md:table-cell">{formatDateTime(p.last_seen, f.tz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
