"use client";

import { CircleAlert, CircleCheck, Loader2, Radar, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { TEST_PATH } from "@/lib/test-visit";
import { sendTestVisit, type TestVisit } from "./actions";

export interface LastVisit {
  id: string;
  timestamp: string;
  bot_name: string;
  page_path: string | null;
}

const POLL_MS = 4000;
const POLL_FOR_MS = 15 * 60_000;

/**
 * Live install status. While no visit has arrived it re-checks every few
 * seconds; the moment the first one lands it says so. "Send a test visit"
 * pushes one visit through the real tracking endpoint to prove the pipeline.
 */
export function InstallStatus({ siteId, last }: { siteId: string; last: LastVisit | null }) {
  const router = useRouter();
  const [test, sendTest, sending] = useActionState<TestVisit>(() => sendTestVisit(siteId), { status: "idle" });

  // Remember whether we started without data, so a later arrival is "first crawler detected".
  const startedEmpty = useRef(last === null);
  const [justArrived, setJustArrived] = useState(false);
  const seenId = useRef(last?.id ?? null);

  useEffect(() => {
    if (last && last.id !== seenId.current) {
      if (startedEmpty.current) setJustArrived(true);
      seenId.current = last.id;
    }
  }, [last]);

  // Poll only while waiting for the first visit, and only for a while.
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

  const isTest = last?.page_path === TEST_PATH;

  return (
    <div className="space-y-3">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
          justArrived ? "border-good/50 bg-good/10" : "border-line bg-surface-2"
        }`}
      >
        {last ? (
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
        ) : (
          <span className="relative mt-1 flex h-3 w-3 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
        )}
        <div className="min-w-0">
          {last ? (
            <>
              <p className="font-medium text-ink">
                {justArrived ? (isTest ? "Test visit detected" : "First crawler detected") : "Tracking is live"}
              </p>
              <p className="text-ink-2" suppressHydrationWarning>
                {last.bot_name} on <span className="font-mono text-[13px]">{last.page_path}</span>, {timeAgo(last.timestamp)}.{" "}
                <Link href={`/dashboard/${siteId}/activity`} className="text-accent-ink hover:underline">
                  Open activity log
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-ink">Listening for the first crawler visit</p>
              <p className="text-ink-2">This updates by itself. Send a test visit to check the setup now.</p>
            </>
          )}
        </div>
      </div>

      <form action={sendTest} className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-md btn-primary px-3 py-1.5 text-sm font-medium"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send a test visit
        </button>
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <Radar className="h-3.5 w-3.5" aria-hidden="true" />
          Recorded as <span className="font-mono">Crawlwatch-TestBot</span> (Unknown) on{" "}
          <span className="font-mono">{TEST_PATH}</span>
        </span>
      </form>

      {test.status !== "idle" && !sending && (
        <p className={`flex items-start gap-1.5 text-sm ${test.status === "recorded" ? "text-good-ink" : "text-ink-2"}`}>
          {test.status === "recorded" ? (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
          )}
          {test.message}
        </p>
      )}
    </div>
  );
}
