"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Stores the browser's time zone in a cookie so the server buckets days in local time. */
export function TimezoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);
  return null;
}
