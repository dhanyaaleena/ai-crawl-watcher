import { redirect } from "next/navigation";
import { getSites } from "@/lib/queries";

export default async function DashboardIndex() {
  const sites = await getSites();
  redirect(sites.length ? `/dashboard/${sites[0].id}` : "/dashboard/new");
}
