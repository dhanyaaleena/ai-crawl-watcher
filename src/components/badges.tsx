import { CircleCheck, TriangleAlert } from "lucide-react";
import { botTypeLabel, platformColor } from "@/lib/platforms";

export const VERIFICATION_HELP = {
  verified: "Came from an IP address on the operator's published list.",
  unverified: "Used this crawler's name, but not from the operator's published IP addresses. Likely an impersonator.",
  unchecked: "This crawler's operator doesn't publish its IP addresses, so it can't be checked.",
} as const;

/** Verified / Unverified / Not checkable. Icon + word, never colour alone. */
export function VerificationTag({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-good-ink" title={VERIFICATION_HELP.verified}>
        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Verified
      </span>
    );
  }
  if (status === "unverified") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-warning-ink" title={VERIFICATION_HELP.unverified}>
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Unverified
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap text-xs text-ink-3" title={VERIFICATION_HELP.unchecked}>
      No public list
    </span>
  );
}

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
