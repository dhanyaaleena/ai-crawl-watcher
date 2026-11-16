export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Public URL of the tracking edge function that the snippet calls. */
export const TRACK_ENDPOINT =
  process.env.NEXT_PUBLIC_TRACK_ENDPOINT ?? `${SUPABASE_URL}/functions/v1/track`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
  );
}
