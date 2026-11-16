"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BOT_TYPES, PLATFORMS } from "../../supabase/functions/_shared/bots";
import { RANGES } from "@/lib/filters";

const selectClass =
  "h-8 appearance-none rounded-md border border-line-strong bg-surface pl-2.5 pr-7 text-sm text-ink outline-none focus:border-accent bg-[length:14px] bg-[right_8px_center] bg-no-repeat";
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2375746f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const range = sp.get("range") ?? "7d";
  const platform = sp.get("platform") ?? "";
  const type = sp.get("type") ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (!value || (key === "range" && value === "7d")) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    const q = next.toString();
    startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <div role="radiogroup" aria-label="Time range" className="inline-flex h-8 rounded-md border border-line-strong bg-surface p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={range === r.key}
            title={r.label}
            onClick={() => update("range", r.key)}
            className={`rounded px-2.5 text-sm ${range === r.key ? "bg-surface-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--border)]" : "text-ink-2 hover:text-ink"}`}
          >
            {r.short}
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor="filter-platform">Platform</label>
      <select id="filter-platform" value={platform} onChange={(e) => update("platform", e.target.value)} className={selectClass} style={{ backgroundImage: chevron }}>
        <option value="">All platforms</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-type">Bot type</label>
      <select id="filter-type" value={type} onChange={(e) => update("type", e.target.value)} className={selectClass} style={{ backgroundImage: chevron }}>
        <option value="">All bot types</option>
        {BOT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {(platform || type) && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(sp);
            next.delete("platform");
            next.delete("type");
            next.delete("page");
            const q = next.toString();
            startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
          }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-ink-2 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
      {pending && <span className="text-xs text-ink-3">Updating…</span>}
    </div>
  );
}
