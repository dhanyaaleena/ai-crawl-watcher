"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/dashboard") ? s : "/dashboard";
}

function credentials(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  };
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const next = safeNext(form.get("next"));
  if (next !== "/dashboard") redirect(next);
  // Go straight to the first site. Redirecting to /dashboard would render a page whose only job is
  // to redirect again, costing the browser a second full round trip before anything shows.
  // Same ordering as getSites(); this client already holds the new session.
  const { data } = await supabase.from("sites").select("id").order("created_at").limit(1);
  redirect(data?.[0] ? `/dashboard/${data[0].id}` : "/dashboard/new");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!email || password.length < 8) return { error: "Use a valid email and a password of at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  // With email confirmation on, Supabase returns no session until the link is clicked.
  if (!data.session) return { message: "Check your inbox to confirm your email, then sign in." };
  redirect("/dashboard/new"); // a new account has no sites yet

}
