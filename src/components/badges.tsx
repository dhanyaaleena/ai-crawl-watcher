import { botTypeLabel, platformColor } from "@/lib/platforms";

export function SampleDataTag() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-line-strong px-2 py-0.5 text-xs font-medium text-ink-2"
      title="This site's visits were generated for demonstration. They are not real crawler traffic."
    >
      Sample data
    </span>
  );
}

export function PlatformTag({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: platformColor(platform) }} aria-hidden="true" />
      {platform}
    </span>
  );
}

export function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded border border-line px-1.5 py-0.5 text-xs text-ink-2">
      {botTypeLabel(type)}
    </span>
  );
}
