import { Radar } from "lucide-react";
import Link from "next/link";

export function EmptyState({ siteId, filtered }: { siteId: string; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <Radar className="h-8 w-8 text-ink-3" aria-hidden="true" />
      <h2 className="mt-3 font-medium">{filtered ? "No crawler visits match these filters" : "No crawler visits yet"}</h2>
      <p className="mt-1 max-w-md text-sm text-ink-3">
        {filtered
          ? "Try a longer time range or clear the platform and bot type filters."
          : "Once the tracking code is on your site, visits from AI crawlers show up here within seconds."}
      </p>
      {!filtered && (
        <Link href={`/dashboard/${siteId}/settings`} className="mt-4 rounded-md btn-primary px-3 py-1.5 text-sm font-medium">
          Get the tracking code
        </Link>
      )}
    </div>
  );
}
