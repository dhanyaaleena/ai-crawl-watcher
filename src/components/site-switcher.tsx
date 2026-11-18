"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SelectMenu } from "@/components/select-menu";

/** Letter avatar for a domain (no favicon fetch, so no third-party request leaks the domain). */
function SiteAvatar({ domain }: { domain: string }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-[10px] font-semibold uppercase text-ink-2"
      aria-hidden="true"
    >
      {domain.replace(/^www\./, "").charAt(0)}
    </span>
  );
}

export function SiteSwitcher({
  sites,
  currentId,
}: {
  sites: { id: string; domain: string }[];
  currentId: string | null;
  /** Kept for callers; the menu generates its own ids. */
  idSuffix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (!sites.length) {
    return (
      <Link href="/dashboard/new" className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-2.5 py-2 text-sm text-ink-2 hover:text-ink">
        <Plus className="h-4 w-4" /> Add a site
      </Link>
    );
  }

  return (
    <SelectMenu
      label="Site"
      value={currentId ?? ""}
      placeholder="Choose a site"
      options={sites.map((s) => ({ value: s.id, label: s.domain, leading: <SiteAvatar domain={s.domain} /> }))}
      onChange={(id) => {
        // Stay on the same view when switching sites.
        const rest = currentId ? (pathname.split(`/dashboard/${currentId}`)[1] ?? "") : "";
        router.push(`/dashboard/${id}${rest}`);
      }}
      search="Search sites…"
      sectionLabel="Your sites"
      footer={(close) => (
        <Link
          href="/dashboard/new"
          onClick={close}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="h-4 w-4 text-ink-3" aria-hidden="true" />
          Add another site
        </Link>
      )}
      fullWidth
      triggerClassName="h-10 px-2.5 font-medium"
    />
  );
}
