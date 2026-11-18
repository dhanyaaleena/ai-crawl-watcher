import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlatformTag, SampleDataTag, TypeTag, VerificationTag } from "@/components/badges";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PathSearch } from "@/components/path-search";
import { filtersToQuery } from "@/lib/filters";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ACTIVITY_PAGE_SIZE, getActivity, type Verification } from "@/lib/queries";
import { loadSitePage } from "../_data";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/activity">) {
  const { site, filters: f, sp } = await loadSitePage(params, searchParams);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : null;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const verification = (["verified", "unverified", "unchecked"] as const).find((v) => v === sp.v) ?? null;
  const { rows, total } = await getActivity(site.id, f, { page, q, verification });
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));

  const clearVerificationHref = () => {
    const base = filtersToQuery(f);
    return `/dashboard/${site.id}/activity${base}${q ? (base ? "&" : "?") + new URLSearchParams({ q }) : ""}`;
  };

  const pageHref = (n: number) => {
    const base = filtersToQuery(f);
    const extra = new URLSearchParams();
    if (q) extra.set("q", q);
    if (verification) extra.set("v", verification);
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
      {verification && <VerificationFilterNote verification={verification} clearHref={clearVerificationHref()} />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <PathSearch />
        </Suspense>
        <span className="text-sm text-ink-3">{formatNumber(total)} visit{total === 1 ? "" : "s"}</span>
      </div>

      {total === 0 ? (
        <EmptyState siteId={site.id} filtered={Boolean(f.platform || f.type || q || verification)} />
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="w-36 px-5 py-2 font-medium">Time</th>
                  <th className="w-40 px-3 py-2 font-medium">Bot</th>
                  <th className="w-32 px-3 py-2 font-medium">Platform</th>
                  <th className="w-28 px-3 py-2 font-medium">Purpose</th>
                  <th className="w-28 px-3 py-2 font-medium">IP check</th>
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="w-[28%] px-5 py-2 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-ink-2">
                      <time dateTime={r.timestamp}>{formatDateTime(r.timestamp, f.tz)}</time>
                    </td>
                    <td className="truncate px-3 py-2.5 font-medium" title={r.bot_name}>{r.bot_name}</td>
                    <td className="px-3 py-2.5"><PlatformTag platform={r.platform} /></td>
                    <td className="px-3 py-2.5"><TypeTag type={r.bot_type} /></td>
                    <td className="px-3 py-2.5"><VerificationTag status={r.verification} /></td>
                    <td className="px-3 py-2.5">
                      <span className="block truncate font-mono text-[13px]" title={r.page_url}>{r.page_path}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="block truncate font-mono text-xs text-ink-3" title={r.user_agent}>{r.user_agent}</span>
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
        </Card>
      )}
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

function VerificationFilterNote({ verification, clearHref }: { verification: Verification; clearHref: string }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
      Showing only visits marked <VerificationTag status={verification} />
      <Link href={clearHref} className="text-accent-ink hover:underline">
        Show all
      </Link>
    </p>
  );
}
