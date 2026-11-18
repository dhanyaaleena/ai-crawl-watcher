import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { changeVsPrevious, formatNumber, formatPercent, plural } from "@/lib/format";
import type { PurposeSplit } from "@/lib/purpose";

/**
 * Training vs retrieval: training crawlers vs search and assistant bots.
 * Numbers stay on screen; explanations live behind ⓘ tooltips.
 */
export function LearnVsCite({ split, previous }: { split: PurposeSplit; previous: PurposeSplit }) {
  const known = split.learning.visits + split.citing.visits;
  const rows = split.platforms.slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.learning, r.citing)));

  return (
    <section className="rounded-xl border border-line bg-surface" aria-labelledby="lvc-title">
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5">
          <h2 id="lvc-title" className="text-sm font-medium text-ink">
            Training vs retrieval
          </h2>
          <InfoTip label="About training vs retrieval">
            {split.takeaway && <span className="block text-ink">{split.takeaway}</span>}
            <span className="mt-1.5 block">
              Training crawlers collect content for AI models. Retrieval bots fetch pages to answer people&apos;s questions and may
              link back to you.
            </span>
            {split.unknown > 0 && <span className="mt-1.5 block text-ink-3">Excludes {plural(split.unknown, "visit")} from unclassified bots.</span>}
          </InfoTip>
        </div>
      </div>

      {/* Split bar */}
      <div className="px-5 pt-3" role="img" aria-label={split.takeaway ?? "No classified AI visits"}>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
          {split.learning.visits > 0 && <span className="h-full rounded-l-full bg-learn" style={{ width: `${split.learning.share * 100}%` }} />}
          {split.citing.visits > 0 && <span className="h-full rounded-r-full bg-cite" style={{ width: `${split.citing.share * 100}%` }} />}
        </div>
      </div>

      <div className="grid gap-px pt-4 sm:grid-cols-2">
        <Side
          tone="learn"
          label="Training"
          visits={split.learning.visits}
          share={formatPercent(split.learning.visits, known)}
          previous={previous.learning.visits}
          explain="Crawlers collecting content for AI model training. They don't send visitors."
          bots={split.learning.topBots}
        />
        <Side
          tone="cite"
          label="Retrieval"
          visits={split.citing.visits}
          share={formatPercent(split.citing.visits, known)}
          previous={previous.citing.visits}
          explain="Search indexing and on-demand fetches used to answer people's questions. These can link back to your pages."
          detail={`${formatNumber(split.citing.search)} search · ${formatNumber(split.citing.assistant)} assistant`}
          bots={split.citing.topBots}
        />
      </div>

      {rows.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <div className="mb-2 grid grid-cols-[6.5rem_1fr_1fr] text-xs text-ink-3 sm:grid-cols-[8rem_1fr_1fr]">
            <span className="pr-3">By platform</span>
            <span className="pr-2 text-right">Training</span>
            <span className="pl-2">Retrieval</span>
          </div>
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.platform} className="grid grid-cols-[6.5rem_1fr_1fr] items-center text-sm sm:grid-cols-[8rem_1fr_1fr]">
                <span className="truncate pr-3 text-ink-2" title={r.platform}>
                  {r.platform}
                </span>
                <span className="flex items-center justify-end gap-2 border-r border-line-strong py-0.5">
                  {r.learning > 0 && <span className="tabular-nums text-xs text-ink-2">{formatNumber(r.learning)}</span>}
                  <span
                    className="h-2.5 rounded-l-sm bg-learn"
                    style={{ width: `${(r.learning / max) * 100}%`, minWidth: r.learning ? 3 : 0 }}
                    aria-hidden="true"
                  />
                </span>
                <span className="flex items-center gap-2 py-0.5">
                  <span
                    className="h-2.5 rounded-r-sm bg-cite"
                    style={{ width: `${(r.citing / max) * 100}%`, minWidth: r.citing ? 3 : 0 }}
                    aria-hidden="true"
                  />
                  {r.citing > 0 && <span className="tabular-nums text-xs text-ink-2">{formatNumber(r.citing)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Side({
  tone,
  label,
  visits,
  share,
  previous,
  explain,
  detail,
  bots,
}: {
  tone: "learn" | "cite";
  label: string;
  visits: number;
  share: string;
  previous: number;
  explain: string;
  detail?: string;
  bots: string[];
}) {
  const change = changeVsPrevious(visits, previous);
  return (
    <div className="min-w-0 border-t border-line px-5 py-4 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <span className={`h-2.5 w-2.5 rounded-sm ${tone === "learn" ? "bg-learn" : "bg-cite"}`} aria-hidden="true" />
        {label}
        <InfoTip label={`About ${label.toLowerCase()}`} align={tone === "cite" ? "right" : "left"}>
          <span className="block text-ink">{explain}</span>
          {detail && <span className="mt-1.5 block">{detail}</span>}
          {bots.length > 0 && <span className="mt-1.5 block">Top bots: {bots.slice(0, 5).join(", ")}{bots.length > 5 && ` +${bots.length - 5} more`}</span>}
        </InfoTip>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(visits)}</span>
        <span className="text-sm text-ink-3">{share}</span>
        {change && (
          <span className="inline-flex items-center gap-0.5 text-xs text-ink-3" title="Compared with the previous period of the same length">
            {change.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {change.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {change.label} vs previous
          </span>
        )}
      </div>
    </div>
  );
}
