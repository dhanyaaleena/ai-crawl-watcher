const nf = new Intl.NumberFormat("en-US");

export const formatNumber = (n: number | null | undefined) => nf.format(Number(n ?? 0));

export const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;

export function formatPercent(part: number, whole: number): string {
  if (!whole) return "0%";
  const p = (part / whole) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

export function formatDateTime(iso: string | number | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatBucket(t: number, bucket: "hour" | "day", tz: string, long = false): string {
  const opts: Intl.DateTimeFormatOptions =
    bucket === "hour"
      ? { timeZone: tz, hour: "numeric", ...(long ? { month: "short", day: "numeric" } : {}) }
      : { timeZone: tz, month: "short", day: "numeric", ...(long ? { weekday: "short" } : {}) };
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(t));
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Signed change versus the previous period, or null when there is nothing to compare. */
export function changeVsPrevious(current: number, previous: number): { label: string; direction: "up" | "down" | "flat" } | null {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "No change", direction: "flat" };
  return { label: `${pct > 0 ? "+" : ""}${pct}%`, direction: pct > 0 ? "up" : "down" };
}
