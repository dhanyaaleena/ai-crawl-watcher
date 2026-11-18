import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * The signed-in user for this request (deduplicated across layouts and pages).
 *
 * `getClaims()` verifies the session token's signature locally against the
 * project's public ES256 key (fetched once, cached for 10 minutes), instead of
 * `getUser()`, which asks Supabase Auth over the network. The proxy already
 * makes that network check on every request (it also catches signed-out
 * sessions), and the database verifies the token again for every query, so a
 * second network check here only added a round trip per click.
 */
export const getUser = cache(async (): Promise<{ id: string; email?: string } | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: data.claims.email };
});
