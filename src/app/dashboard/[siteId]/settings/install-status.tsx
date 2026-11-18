"use client";

import { CircleAlert, CircleCheck, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { sendTestVisit, type TestVisit } from "./actions";
import { InstallCheckButton } from "./install-check";
import { StatusBadge } from "./status-badge";

export interface LastVisit {
  id: string;
  timestamp: string;
  bot_name: string;
  page_path: string | null;
}

const POLL_MS = 4000;
const POLL_FOR_MS = 15 * 60_000;

/**
 * Setup progress: three steps, each with its own evidence.
 *  1. Domain: the site exists.
 *  2. Code installed: "Check installation" found it on the homepage (stored),
 *     or a real crawler visit has arrived through it.
 *  3. Crawler visit: a real crawler has visited. Test visits only prove the
 *     tracker works, so they are shown as a note and never complete a step.
 * Until a real visit arrives the card re-checks every few seconds (for up to 15
 * minutes) and flips step 3 the moment one lands.
 */
export function SetupProgress({
  siteId,
  domain,
  installVerifiedAt,
  last,
  lastTest,
}: {
  siteId: string;
  domain: string;
  installVerifiedAt: string | null;
  last: LastVisit | null;
  lastTest: LastVisit | null;
}) {
  const router = useRouter();
  const [test, sendTest, sending] = useActionState<TestVisit>(() => sendTestVisit(siteId), { status: "idle" });

  const startedEmpty = useRef(last === null);
  const [justArrived, setJustArrived] = useState(false);
  const seenId = useRef(last?.id ?? null);

  useEffect(() => {
    if (last && last.id !== seenId.current) {
      if (startedEmpty.current) setJustArrived(true);
      seenId.current = last.id;
    }
  }, [last]);

  useEffect(() => {
    if (last) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - started > POLL_FOR_MS) return clearInterval(id);
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [last, router]);

  const installed = Boolean(installVerifiedAt || last);
  const visited = Boolean(last);
  const done = 1 + Number(installed) + Number(visited);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-3">Setup progress</p>
        <p className="mt-1 text-4xl font-normal leading-none tracking-[-0.04em] tabular-nums" aria-live="polite">
          {done}/3
        </p>
      </div>

      <ol className="space-y-3">
        <Step n={1} title="Add your domain" status="Connected">
          Visits are accepted from <span className="font-mono text-[13px] text-ink-2">{domain}</span> and its subdomains.
        </Step>
        <Step n={2} title="Install the tracking code" status={installed ? "Connected" : "Waiting"}>
          <span suppressHydrationWarning>
            {installVerifiedAt
              ? `Found on your homepage ${timeAgo(installVerifiedAt)}.`
              : last
                ? "Crawler visits are arriving through it."
                : "Paste the snippet into every page's <head>, publish, then check."}
          </span>
          <div className="mt-3">
            <InstallCheckButton siteId={siteId} label={installVerifiedAt ? "Check again" : "Check installation"} />
          </div>
        </Step>
        <Step
          n={3}
          title={justArrived ? "First crawler detected" : "Receive a crawler visit"}
          status={visited ? "Connected" : "Listening"}
          highlight={justArrived}
        >
          {last ? (
            <span suppressHydrationWarning>
              {last.bot_name} on <span className="font-mono text-[13px] text-ink-2">{last.page_path}</span>, {timeAgo(last.timestamp)}.{" "}
              <Link href={`/dashboard/${siteId}/activity`} className="text-accent-ink">
                Open activity log
              </Link>
            </span>
          ) : (
            "Waiting for the first real crawler. This updates by itself."
          )}
          {lastTest && (
            <p className="mt-1.5 text-xs text-ink-3" suppressHydrationWarning>
              Test visit received {timeAgo(lastTest.timestamp)}: the tracker works. Test visits don&apos;t complete this step.
            </p>
          )}
          <form action={sendTest} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send a test visit
            </button>
          </form>
          {test.status !== "idle" && !sending && (
            <p role="status" className={`mt-2 flex items-start gap-1.5 text-sm ${test.status === "recorded" ? "text-good-ink" : "text-ink-2"}`}>
              {test.status === "recorded" ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
              )}
              {test.message}
            </p>
          )}
        </Step>
      </ol>
    </div>
  );
}

function Step({
  n,
  title,
  status,
  highlight,
  children,
}: {
  n: number;
  title: string;
  status: "Connected" | "Waiting" | "Listening";
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const ok = status === "Connected";
  return (
    <li
      className={`grid grid-cols-[1.5rem_1fr] gap-3 rounded-lg border px-4 py-3 transition-colors ${
        highlight ? "border-good/40 bg-good-soft" : "border-line bg-surface"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          ok ? "bg-ink text-surface" : "border border-line-strong text-ink-2"
        }`}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <div className="mt-1 text-sm text-ink-3">{children}</div>
      </div>
    </li>
  );
}
