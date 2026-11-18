"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RecentVisit } from "@/lib/queries";
import { botTypeLabel, platformColor } from "@/lib/platforms";

const POLL_MS = 5000;

/**
 * The crawl log: the site's newest crawler visits as access-log lines, the
 * way crawler traffic has always looked in a server log. While the tab is
 * visible it checks for new visits every few seconds and slides them in.
 */
export function LiveLog({ siteId, initial, tz }: { siteId: string; initial: RecentVisit[]; tz: string }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef(new Set(initial.map((r) => r.id)));

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/recent?site=${encodeURIComponent(siteId)}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { visits } = (await res.json()) as { visits: RecentVisit[] };
        const added = visits.filter((v) => !known.current.has(v.id)).map((v) => v.id);
        if (!added.length) return;
        added.forEach((id) => known.current.add(id));
        setRows(visits);
        setFresh(new Set(added));
      } catch {
        // Offline or signed out: try again on the next tick.
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [siteId]);

  return (
    <section aria-labelledby="log-title" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-good opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
          </span>
          <h2 id="log-title" className="text-sm font-medium text-ink">
            Crawl log
          </h2>
          <span className="hidden font-mono text-xs text-ink-3 sm:inline">live · newest first</span>
        </div>
        <Link href={`/dashboard/${siteId}/activity`} className="text-xs text-accent-ink hover:underline">
          Full activity log
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-6 font-mono text-xs text-ink-3">Waiting for the first crawler…</p>
      ) : (
        <ol className="divide-y divide-line font-mono text-[12.5px] leading-6" aria-live="polite" aria-relevant="additions">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`grid grid-cols-[4rem_minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-x-3 px-4 py-1.5 sm:grid-cols-[6.5rem_minmax(0,10rem)_7rem_minmax(0,1fr)] sm:gap-x-4 sm:px-5 ${
                fresh.has(r.id) ? "log-line-new" : ""
              }`}
            >
              <time dateTime={r.timestamp} className="tabular-nums text-ink-3" suppressHydrationWarning>
                {logTime(r.timestamp, tz)}
              </time>
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: platformColor(r.platform) }} aria-hidden="true" />
                <span className="truncate" title={`${r.bot_name} · ${r.platform}`}>
                  {r.bot_name}
                </span>
              </span>
              <span className="hidden truncate text-ink-3 sm:block">{botTypeLabel(r.bot_type).replace(/^AI /, "").toLowerCase()}</span>
              <span className="truncate text-ink-2" title={r.page_path ?? ""}>
                <span className="hidden text-ink-3 sm:inline">GET </span>
                {r.page_path}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "14:02:11" for today, "17 Nov 14:02" for older lines, in the viewer's time zone. */
function logTime(iso: string, tz: string): string {
  const d = new Date(iso);
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(x);
  const today = day(d) === day(new Date());
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    ...(today ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    hour12: false,
  }).format(d);
}
