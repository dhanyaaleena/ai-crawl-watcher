"use client";

import { useParams } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { SiteSwitcher } from "@/components/site-switcher";

export function SiteNav({ sites, variant }: { sites: { id: string; domain: string }[]; variant: "side" | "top" }) {
  const params = useParams<{ siteId?: string }>();
  const siteId = params.siteId && sites.some((s) => s.id === params.siteId) ? params.siteId : null;
  return (
    <div className={variant === "side" ? "space-y-4" : "space-y-2"}>
      <SiteSwitcher sites={sites} currentId={siteId} idSuffix={variant} />
      {siteId && <SidebarNav siteId={siteId} variant={variant} />}
    </div>
  );
}
