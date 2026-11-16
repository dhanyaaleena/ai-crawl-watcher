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
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!email || password.length < 8) return { error: "Use a valid email and a password of at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  // With email confirmation on, Supabase returns no session until the link is clicked.
  if (!data.session) return { message: "Check your inbox to confirm your email, then sign in." };
  redirect("/dashboard");
}
