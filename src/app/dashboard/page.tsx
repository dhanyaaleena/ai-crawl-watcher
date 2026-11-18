import { redirect } from "next/navigation";
import { getSites } from "@/lib/queries";

export default async function DashboardIndex({ searchParams }: PageProps<"/dashboard">) {
  const sites = await getSites();
  // Keep the query string (e.g. ?palette=ledger) when forwarding to the first site.
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") sp.set(k, v);
  const q = sp.toString() ? `?${sp}` : "";
  redirect(sites.length ? `/dashboard/${sites[0].id}${q}` : `/dashboard/new${q}`);
}
