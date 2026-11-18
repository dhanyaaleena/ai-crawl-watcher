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
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="w-12 py-2 pl-5 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="w-52 px-3 py-2 font-medium">Visits</th>
                  <th className="w-16 px-3 py-2 text-right font-medium">Bots</th>
                  <th className="w-44 px-3 py-2 font-medium">Platforms</th>
                  <th className="w-40 px-5 py-2 text-right font-medium">Last crawled</th>
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
                        <span className="w-12 text-right tabular-nums">{formatNumber(p.visits)}</span>
                        <span className="h-1.5 flex-1 rounded-full bg-surface-2" aria-hidden="true">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${(Number(p.visits) / max) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(p.bots)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1" title={p.platforms.join(", ")}>
                        {[...new Set(p.platforms.map(platformColor))].map((color) => (
                          <span key={color} className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                        ))}
                        <span className="ml-1 truncate text-xs text-ink-3">
                          {p.platforms.length === 1 ? p.platforms[0] : `${p.platforms.length} platforms`}
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right text-ink-2">{formatDateTime(p.last_seen, f.tz)}</td>
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
