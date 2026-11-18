import { CircleCheck, Code2, Download, Globe } from "lucide-react";
import type { Metadata } from "next";
import { SampleDataTag } from "@/components/badges";
import { Card } from "@/components/card";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { TRACK_ENDPOINT } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getSetupSignals } from "@/lib/queries";
import { headSnippet, bodySnippet, serverSnippet } from "@/lib/snippet";
import { loadSitePage } from "../_data";
import { DeleteSiteButton } from "./delete-site";
import { SetupProgress } from "./install-status";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/dashboard/[siteId]/settings">) {
  const { site, filters: f, sp } = await loadSitePage(params, searchParams);
  const { lastReal: last, lastTest } = await getSetupSignals(site.id);
  const head = headSnippet(site.id, TRACK_ENDPOINT);
  const body = bodySnippet(site.id, TRACK_ENDPOINT);
  const server = serverSnippet(site.id, TRACK_ENDPOINT);

  return (
    <>
      <PageHeader title="Settings" description={`Tracking code and data for ${site.domain}.`} badge={site.is_sample ? <SampleDataTag /> : undefined} />

      {sp.welcome === "1" && !last && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-5 py-4 text-sm">
          <p className="font-medium text-ink">{site.domain} is ready.</p>
          <p className="mt-0.5 text-ink-2">Add the tracking code below to your site. It takes about two minutes.</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
        <Card title="Site" subtitle={site.domain} icon={<Globe />}>
          {/* Label above value: this column is narrow on laptops, so side-by-side pairs would squeeze the values. */}
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Domain</dt>
              <dd className="mt-0.5">
                {site.domain} <span className="text-ink-3">and its subdomains</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Site ID</dt>
              <dd className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
                <code className="min-w-0 break-all font-mono text-[13px]">{site.id}</code>
                <CopyButton text={site.id} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Added</dt>
              <dd className="mt-0.5">{formatDateTime(site.created_at, f.tz)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Privacy</dt>
              <dd className="mt-0.5 text-ink-2">
                IP addresses are truncated and hashed before storage. Query strings and fragments are dropped from page URLs. Human
                visitors are never recorded.
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-col items-start gap-3 border-t border-line pt-4">
            <p className="text-sm text-ink-2">Remove this site and permanently delete its crawler data.</p>
            <DeleteSiteButton siteId={site.id} domain={site.domain} />
          </div>
        </Card>
        <Card title="Export" className="flex-1">
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-2">
              Every recorded crawler visit for {site.domain} as CSV: time, URL, bot, platform, type, user agent, path and hashed IP.
            </p>
            <a
              href={`/api/export?site=${site.id}&all=1`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md btn-primary px-3 py-1.5 text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Download all data
            </a>
          </div>
        </Card>
        </div>
          <Card
            title="Setup"
            subtitle="Three steps"
            icon={<CircleCheck />}
            footer="Takes about two minutes. This card updates by itself when the first visit arrives."
          >
            <SetupProgress
              siteId={site.id}
              domain={site.domain}
              installVerifiedAt={site.install_verified_at}
              last={last && { id: last.id, timestamp: last.timestamp, bot_name: last.bot_name, page_path: last.page_path }}
              lastTest={lastTest && { id: lastTest.id, timestamp: lastTest.timestamp, bot_name: lastTest.bot_name, page_path: lastTest.page_path }}
            />
          </Card>
        </div>

        <Card title="Tracking code" subtitle="Copy into your site" icon={<Code2 />}>
          <ol className="space-y-6">
            <Step n={1} title="Paste this inside <head> on every page" id="code-head">
              <Snippet code={head} />
              <p className="mt-2 text-xs text-ink-3">
                Loads asynchronously and adds about 300 bytes to your page. Ordinary visitors are ignored; only crawlers are recorded.
              </p>
            </Step>
            <Step n={2} title="Recommended: paste this right after <body>" id="code-body">
              <Snippet code={body} />
              <p className="mt-2 text-xs text-ink-3">
                Many AI crawlers don’t run JavaScript. This 1×1 image catches the ones that still load images.
              </p>
            </Step>
          </ol>

          <details id="code-server" className="mt-6 scroll-mt-6 rounded-lg border border-line px-4 py-3 text-sm">
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


      </div>
    </>
  );
}

function Step({ n, title, id, children }: { n: number; title: string; id?: string; children: React.ReactNode }) {
  return (
    <li id={id} className="grid scroll-mt-6 grid-cols-[1.5rem_1fr] gap-3">
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
