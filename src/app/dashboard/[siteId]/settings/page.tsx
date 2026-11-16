import { CircleCheck, Clock, Download } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/card";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { TRACK_ENDPOINT } from "@/lib/env";
import { formatDateTime, timeAgo } from "@/lib/format";
import { getLastEvent } from "@/lib/queries";
import { headSnippet, bodySnippet, serverSnippet } from "@/lib/snippet";
import { loadSitePage } from "../_data";
import { DeleteSiteButton } from "./delete-site";
import { InstallCheckButton } from "./install-check";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/settings">) {
  const { site, filters: f, sp } = await loadSitePage(params, searchParams);
  const last = await getLastEvent(site.id);
  const head = headSnippet(site.id, TRACK_ENDPOINT);
  const body = bodySnippet(site.id, TRACK_ENDPOINT);
  const server = serverSnippet(site.id, TRACK_ENDPOINT);

  return (
    <>
      <PageHeader title="Settings" description={`Tracking code and data for ${site.domain}.`} />

      {sp.welcome === "1" && !last && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-5 py-4 text-sm">
          <p className="font-medium text-ink">{site.domain} is ready.</p>
          <p className="mt-0.5 text-ink-2">Add the tracking code below to your site. It takes about two minutes.</p>
        </div>
      )}

      <div className="space-y-4">
        <Card title="Tracking code">
          <ol className="space-y-6">
            <Step n={1} title="Paste this inside <head> on every page">
              <Snippet code={head} />
              <p className="mt-2 text-xs text-ink-3">
                Loads asynchronously and adds about 300 bytes to your page. Ordinary visitors are ignored; only crawlers are recorded.
              </p>
            </Step>
            <Step n={2} title="Recommended: paste this right after <body>">
              <Snippet code={body} />
              <p className="mt-2 text-xs text-ink-3">
                Many AI crawlers don’t run JavaScript. This 1×1 image catches the ones that still load images.
              </p>
            </Step>
            <Step n={3} title="Confirm it’s live">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <InstallCheckButton siteId={site.id} />
                <div className="flex items-center gap-1.5 text-sm text-ink-2">
                  {last ? (
                    <>
                      <CircleCheck className="h-4 w-4 text-good" aria-hidden="true" />
                      <span>
                        Last crawler visit {timeAgo(last.timestamp)} · {last.bot_name} on{" "}
                        <span className="font-mono text-[13px]">{last.page_path}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      <span>Waiting for the first crawler visit</span>
                    </>
                  )}
                </div>
              </div>
            </Step>
          </ol>

          <details className="mt-6 rounded-lg border border-line px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink-2">Catch every crawler with server-side forwarding</summary>
            <p className="mt-2 text-ink-3">
              Crawlers that skip both JavaScript and images are only visible to your server. Forward their requests from your
              middleware (Next.js example below; any server that can make an HTTP request works).
            </p>
            <div className="mt-3">
              <Snippet code={server} />
            </div>
          </details>
        </Card>

        <Card title="Export">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              Every recorded crawler visit for {site.domain} as CSV: time, URL, bot, platform, type, user agent, path and hashed IP.
            </p>
            <a
              href={`/api/export?site=${site.id}&all=1`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Download all data
            </a>
          </div>
        </Card>

        <Card title="Site">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-ink-3">Domain</dt>
            <dd>{site.domain} <span className="text-ink-3">and its subdomains</span></dd>
            <dt className="text-ink-3">Site ID</dt>
            <dd className="flex items-center gap-2"><code className="font-mono text-[13px]">{site.id}</code><CopyButton text={site.id} /></dd>
            <dt className="text-ink-3">Added</dt>
            <dd>{formatDateTime(site.created_at, f.tz)}</dd>
            <dt className="text-ink-3">Privacy</dt>
            <dd className="text-ink-2">
              IP addresses are truncated and hashed before storage. Query strings and fragments are dropped from page URLs. Human
              visitors are never recorded.
            </dd>
          </dl>
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">Remove this site and permanently delete its crawler data.</p>
            <DeleteSiteButton siteId={site.id} domain={site.domain} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-ink-2">{n}</span>
      <div className="min-w-0">
        <h3 className="mb-2 pt-0.5 text-sm font-medium">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function Snippet({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg border border-line bg-surface-2">
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 pr-24 font-mono text-xs leading-relaxed text-ink-2">
        <code>{code}</code>
      </pre>
    </div>
  );
}
