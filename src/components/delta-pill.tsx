import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/** Change vs the previous period as a small pill: green for growth, neutral otherwise. */
export function DeltaPill({ change }: { change: { label: string; direction: "up" | "down" | "flat" } }) {
  const up = change.direction === "up";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums ${
        up ? "bg-good-soft text-good-ink" : "bg-surface-2 text-ink-2"
      }`}
      title="Compared with the previous period of the same length"
    >
      {up && <ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
      {change.direction === "down" && <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
      {change.label}
    </span>
  );
}
