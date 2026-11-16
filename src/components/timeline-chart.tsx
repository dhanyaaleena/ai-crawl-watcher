"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBucket, formatNumber } from "@/lib/format";
import { platformColor } from "@/lib/platforms";
import type { TimeseriesPoint } from "@/lib/queries";

interface Props {
  points: TimeseriesPoint[];
  series: string[];
  bucket: "hour" | "day";
  tz: string;
}

/** Crawler visits per hour/day, stacked by platform. */
export function TimelineChart({ points, series, bucket, tz }: Props) {
  const tickEvery = points.length > 14 ? Math.ceil(points.length / 8) : 1;

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
          {series.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: platformColor(s === "Other" ? "" : s) }} />
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="t"
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              tick={{ fill: "var(--text-3)", fontSize: 11 }}
              interval={tickEvery - 1}
              tickFormatter={(t: number) => formatBucket(t, bucket, tz)}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-3)", fontSize: 11 }}
              width={44}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              isAnimationActive={false}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TimeseriesPoint;
                const rows = series.filter((s) => point[s] > 0).reverse();
                return (
                  <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1.5 font-medium text-ink">{formatBucket(Number(label), bucket, tz, true)}</div>
                    {rows.map((s) => (
                      <div key={s} className="flex items-center justify-between gap-4 py-0.5 text-ink-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: platformColor(s === "Other" ? "" : s) }} />
                          {s}
                        </span>
                        <span className="tabular-nums text-ink">{formatNumber(point[s])}</span>
                      </div>
                    ))}
                    <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-medium text-ink">
                      <span>Total</span>
                      <span className="tabular-nums">{formatNumber(point.total)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {series.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="visits"
                fill={platformColor(s === "Other" ? "" : s)}
                stroke="var(--surface)"
                strokeWidth={1}
                radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
