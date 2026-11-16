"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSite } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export interface InstallCheck {
  status: "idle" | "found" | "missing" | "error";
  message?: string;
}

/** Hosts we refuse to fetch server side (no IP literals, local or internal names). */
function isFetchableHost(domain: string): boolean {
  if (/^[\d.]+$/.test(domain) || domain.includes(":")) return false;
  if (!domain.includes(".")) return false;
  return !/\.(local|localhost|internal|lan|home|test|invalid|example)$/.test(domain);
}

/** Fetches the site's homepage and looks for the site id in the HTML. */
export async function checkInstall(siteId: string): Promise<InstallCheck> {
  const site = await getSite(siteId);
  if (!site) return { status: "error", message: "Site not found." };
  if (!isFetchableHost(site.domain)) {
    return { status: "error", message: `Can't check ${site.domain} from here. Open your page source and look for the snippet.` };
  }
  try {
    const res = await fetch(`https://${site.domain}/`, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Crawlwatch-InstallCheck/1.0)", accept: "text/html" },
      cache: "no-store",
    });
    const html = (await res.text()).slice(0, 3_000_000);
    if (html.includes(siteId)) return { status: "found", message: `Tracking code found on https://${site.domain}/` };
    return {
      status: "missing",
      message: `Didn't find the tracking code on https://${site.domain}/ (HTTP ${res.status}). If you just deployed, wait for caches to clear and try again.`,
    };
  } catch (err) {
    return { status: "error", message: `Couldn't reach https://${site.domain}/ (${(err as Error).message}).` };
  }
}

export async function deleteSite(siteId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", siteId);
  if (error) throw error;
  revalidatePath("/dashboard", "layout"); // the sidebar lists sites
  redirect("/dashboard");
}
