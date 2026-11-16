"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function SiteSwitcher({
  sites,
  currentId,
  idSuffix,
}: {
  sites: { id: string; domain: string }[];
  currentId: string | null;
  idSuffix: string;
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
    <div className="relative">
      <label htmlFor={`site-switcher-${idSuffix}`} className="sr-only">
        Site
      </label>
      <select
        id={`site-switcher-${idSuffix}`}
        value={currentId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (id === "__new") return router.push("/dashboard/new");
          // Stay on the same view when switching sites.
          const rest = currentId ? pathname.split(`/dashboard/${currentId}`)[1] ?? "" : "";
          router.push(`/dashboard/${id}${rest}`);
        }}
        className="w-full appearance-none truncate rounded-md border border-line-strong bg-surface py-2 pl-2.5 pr-8 text-sm font-medium outline-none focus:border-accent"
      >
        {!currentId && <option value="">Choose a site</option>}
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.domain}
          </option>
        ))}
        <option value="__new">+ Add another site</option>
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
    </div>
  );
}
