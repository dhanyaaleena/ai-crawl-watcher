"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Filters the activity log by page path; updates the URL after typing pauses. */
export function PathSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") ?? "");

  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (value.trim() === current) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [value, sp, pathname, router]);

  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">Filter by page path</span>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Filter by page path"
        className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
