"use client";

import { Activity, BarChart3, FileText, LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "", label: "Overview", icon: LayoutGrid },
  { href: "/platforms", label: "Platforms", icon: BarChart3 },
  { href: "/pages", label: "Pages", icon: FileText },
  { href: "/activity", label: "Activity log", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Keeps range/platform/type when moving between views. */
function keptQuery(sp: URLSearchParams): string {
  const q = new URLSearchParams();
  for (const k of ["range", "platform", "type"]) {
    const v = sp.get(k);
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function SidebarNav({ siteId, variant }: { siteId: string; variant: "side" | "top" }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = `/dashboard/${siteId}`;
  const query = keptQuery(sp);

  return (
    <nav aria-label="Dashboard" className={variant === "side" ? "space-y-0.5" : "-mx-4 flex gap-1 overflow-x-auto px-4"}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const target = base + href;
        const active = href === "" ? pathname === base : pathname.startsWith(target);
        return (
          <Link
            key={label}
            href={href === "/settings" ? target : target + query}
            aria-current={active ? "page" : undefined}
            className={
              variant === "side"
                ? `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                    active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`
                : `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
                    active ? "bg-surface-2 font-medium text-ink" : "text-ink-2"
                  }`
            }
          >
            <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
