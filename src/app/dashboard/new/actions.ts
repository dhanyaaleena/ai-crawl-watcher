"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeDomain } from "../../../../supabase/functions/_shared/track-utils";

export interface NewSiteState {
  error?: string;
  domain?: string;
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export async function createSite(_: NewSiteState, form: FormData): Promise<NewSiteState> {
  const raw = String(form.get("domain") ?? "");
  const domain = normalizeDomain(raw);
  if (!DOMAIN.test(domain)) {
    return { error: "Enter a domain like example.com", domain: raw };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("sites").insert({ domain }).select("id").single();
  if (error) {
    return {
      error: error.code === "23505" ? `You already track ${domain}.` : error.message,
      domain: raw,
    };
  }
  revalidatePath("/dashboard", "layout"); // the sidebar lists sites
  redirect(`/dashboard/${data.id}/settings?welcome=1`);
}
