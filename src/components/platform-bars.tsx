import { formatNumber, formatPercent } from "@/lib/format";
import { platformColor } from "@/lib/platforms";

/** Horizontal bars, one per platform, every value labelled directly. */
export function PlatformBars({ rows, limit }: { rows: { platform: string; visits: number }[]; limit?: number }) {
  const total = rows.reduce((n, r) => n + r.visits, 0);
  const shown = limit ? rows.slice(0, limit) : rows;
  const max = shown[0]?.visits ?? 0;
  return (
    <ul className="space-y-2.5">
      {shown.map((r) => (
        <li key={r.platform} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink-2" title={r.platform}>{r.platform}</span>
          <span className="h-2.5 rounded-full bg-surface-2" aria-hidden="true">
            <span
              className="block h-full rounded-full"
              style={{ width: `${max ? Math.max((r.visits / max) * 100, 1.5) : 0}%`, background: platformColor(r.platform) }}
            />
          </span>
          <span className="w-24 text-right tabular-nums">
            <span className="text-ink">{formatNumber(r.visits)}</span>
            <span className="ml-1.5 text-ink-3">{formatPercent(r.visits, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
