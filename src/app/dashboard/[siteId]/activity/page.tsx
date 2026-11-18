import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SampleDataTag } from "@/components/badges";
import { botTypeLabel, platformColor } from "@/lib/platforms";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PathSearch } from "@/components/path-search";
import { filtersToQuery } from "@/lib/filters";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { ACTIVITY_PAGE_SIZE, getActivity } from "@/lib/queries";
import { loadSitePage } from "../_data";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/activity">) {
  const { site, filters: f, sp } = await loadSitePage(params, searchParams);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : null;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const { rows, total } = await getActivity(site.id, f, { page, q });
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));

  const pageHref = (n: number) => {
    const base = filtersToQuery(f);
    const extra = new URLSearchParams();
    if (q) extra.set("q", q);
    if (n > 1) extra.set("page", String(n));
    const e = extra.toString();
    return `/dashboard/${site.id}/activity${base}${e ? (base ? "&" : "?") + e : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every crawler visit, newest first."
        siteId={site.id}
        filters={f}
        badge={site.is_sample ? <SampleDataTag /> : undefined}
      />
      <Card
        title="Crawler log"
        subtitle={`${formatNumber(total)} visit${total === 1 ? "" : "s"}, newest first`}
        icon={<Radio />}
        action={
          <Suspense>
            <PathSearch />
          </Suspense>
        }
        footer="Each request is normalised to bot, platform, purpose and page. Human visitors are never stored."
        flush
      >
      {total === 0 ? (
        <div className="p-4">
          <EmptyState siteId={site.id} filtered={Boolean(f.platform || f.type || q)} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead>
                <tr className="divide-x divide-line border-b border-line text-left text-xs text-ink-3">
                  <th className="w-48 px-5 py-2.5 font-medium">Bot</th>
                  <th className="w-32 px-4 py-2.5 font-medium">Purpose</th>
                  <th className="px-4 py-2.5 font-medium">Page</th>
                  <th className="w-32 px-4 py-2.5 font-medium">Time</th>
                  <th className="hidden w-[24%] px-5 py-2.5 font-medium xl:table-cell">User agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="divide-x divide-line">
                    <td className="px-5 py-3">
                      <span className="block truncate font-medium text-ink" title={r.bot_name}>
                        {r.bot_name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: platformColor(r.platform) }} aria-hidden="true" />
                        {r.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{botTypeLabel(r.bot_type)}</td>
                    <td className="px-4 py-3">
                      <span className="block font-mono text-[11px] font-medium text-ink-3">GET</span>
                      <span className="block truncate font-mono text-[13px] text-ink" title={r.page_url}>
                        {r.page_path}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">
                      <time dateTime={r.timestamp} title={formatDateTime(r.timestamp, f.tz)}>
                        {timeAgo(r.timestamp)}
                      </time>
                    </td>
                    <td className="hidden px-5 py-3 xl:table-cell">
                      <span className="block truncate font-mono text-xs text-ink-3" title={r.user_agent}>
                        {r.user_agent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
              <span className="text-ink-3">
                Page {page} of {formatNumber(pages)}
              </span>
              <span className="flex gap-2">
                <PageLink href={page > 1 ? pageHref(page - 1) : null} label="Newer"><ChevronLeft className="h-4 w-4" /></PageLink>
                <PageLink href={page < pages ? pageHref(page + 1) : null} label="Older"><ChevronRight className="h-4 w-4" /></PageLink>
              </span>
            </nav>
          )}
        </>
      )}
      </Card>
    </>
  );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "inline-flex h-8 items-center gap-1 rounded-md border border-line-strong px-2.5";
  if (!href) return <span className={`${cls} text-ink-3 opacity-50`} aria-disabled="true">{label === "Newer" && children}{label}{label === "Older" && children}</span>;
  return (
    <Link href={href} className={`${cls} text-ink-2 hover:bg-surface-2`} scroll={false}>
      {label === "Newer" && children}
      {label}
      {label === "Older" && children}
    </Link>
  );
}
