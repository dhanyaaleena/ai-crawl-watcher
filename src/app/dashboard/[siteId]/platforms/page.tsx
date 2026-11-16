import type { Metadata } from "next";
import { PlatformTag, TypeTag } from "@/components/badges";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PlatformBars } from "@/components/platform-bars";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { BOT_TYPE_HELP, botTypeLabel } from "@/lib/platforms";
import { getBotBreakdown, groupByPlatform } from "@/lib/queries";
import { BOT_TYPES } from "../../../../../supabase/functions/_shared/bots";
import { loadSitePage } from "../_data";

export const metadata: Metadata = { title: "Platforms" };

export default async function PlatformsPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/platforms">) {
  const { site, filters: f } = await loadSitePage(params, searchParams);
  const bots = await getBotBreakdown(site.id, f);
  const platforms = groupByPlatform(bots);
  const total = platforms.reduce((n, p) => n + p.visits, 0);
  const byType = BOT_TYPES.map((t) => ({
    ...t,
    visits: bots.filter((b) => b.bot_type === t.value).reduce((n, b) => n + Number(b.visits), 0),
  }));
  const maxType = Math.max(...byType.map((t) => t.visits), 1);

  return (
    <>
      <PageHeader title="Platforms" description="Which AI companies crawl your site, and why." siteId={site.id} filters={f} />
      {total === 0 ? (
        <EmptyState siteId={site.id} filtered={Boolean(f.platform || f.type)} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Card title="Visits by platform">
              <PlatformBars rows={platforms} />
            </Card>
            <Card title="Visits by purpose">
              <ul className="space-y-4">
                {byType.map((t) => (
                  <li key={t.value}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{t.label}</span>
                      <span className="tabular-nums">
                        {formatNumber(t.visits)} <span className="text-ink-3">{formatPercent(t.visits, total)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-2" aria-hidden="true">
                      <div className="h-full rounded-full bg-ink-3" style={{ width: `${(t.visits / maxType) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-3">{BOT_TYPE_HELP[t.value]}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="Bots" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-xs text-ink-3">
                    <th className="px-5 py-2 font-medium">Bot</th>
                    <th className="px-3 py-2 font-medium">Platform</th>
                    <th className="px-3 py-2 font-medium">Purpose</th>
                    <th className="px-3 py-2 text-right font-medium">Visits</th>
                    <th className="px-3 py-2 text-right font-medium">Pages</th>
                    <th className="px-5 py-2 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bots.map((b) => (
                    <tr key={`${b.platform}-${b.bot_name}-${b.bot_type}`}>
                      <td className="px-5 py-2.5 font-medium">{b.bot_name}</td>
                      <td className="px-3 py-2.5"><PlatformTag platform={b.platform} /></td>
                      <td className="px-3 py-2.5"><TypeTag type={b.bot_type} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.visits)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(b.pages)}</td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap text-ink-2" title={botTypeLabel(b.bot_type)}>
                        {formatDateTime(b.last_seen, f.tz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
