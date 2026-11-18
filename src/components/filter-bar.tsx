"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useTransition } from "react";
import { BOT_TYPES, PLATFORMS } from "../../supabase/functions/_shared/bots";
import { SelectMenu } from "@/components/select-menu";
import { RANGES } from "@/lib/filters";
import { platformColor } from "@/lib/platforms";

const dot = (color: string) => <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} aria-hidden="true" />;
const PLATFORM_OPTIONS = [
  { value: "", label: "All platforms" },
  ...PLATFORMS.map((p) => ({ value: p, label: p, leading: dot(platformColor(p)) })),
];
const TYPE_OPTIONS = [{ value: "", label: "All bot types" }, ...BOT_TYPES.map((t) => ({ value: t.value, label: t.label }))];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Show the clicked value immediately; the URL (and data) catch up when the server answers.
  const [shown, setShown] = useOptimistic(
    { range: sp.get("range") ?? "7d", platform: sp.get("platform") ?? "", type: sp.get("type") ?? "" },
    (cur, patch: Partial<{ range: string; platform: string; type: string }>) => ({ ...cur, ...patch }),
  );
  const { range, platform, type } = shown;

  // Lets CSS dim the page and show a progress bar while new data loads.
  useEffect(() => {
    const el = document.documentElement;
    if (pending) el.dataset.navPending = "";
    else delete el.dataset.navPending;
    return () => {
      delete el.dataset.navPending;
    };
  }, [pending]);

  function update(key: "range" | "platform" | "type", value: string) {
    const next = new URLSearchParams(sp);
    if (!value || (key === "range" && value === "7d")) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    const q = next.toString();
    startTransition(() => {
      setShown({ [key]: value || (key === "range" ? "7d" : "") });
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    });
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

      <SelectMenu label="Platform" value={platform} options={PLATFORM_OPTIONS} onChange={(v) => update("platform", v)} triggerClassName="h-8 px-2.5" />
      <SelectMenu label="Bot type" value={type} options={TYPE_OPTIONS} onChange={(v) => update("type", v)} triggerClassName="h-8 px-2.5" />

      {(platform || type) && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(sp);
            next.delete("platform");
            next.delete("type");
            next.delete("page");
            const q = next.toString();
            startTransition(() => {
              setShown({ platform: "", type: "" });
              router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
            });
          }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-ink-2 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
      {pending && (
        <span className="text-xs text-ink-3" role="status">
          Updating…
        </span>
      )}
    </div>
  );
}
