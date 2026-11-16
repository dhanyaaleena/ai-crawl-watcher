"use client";

import { useTransition } from "react";
import { deleteSite } from "./actions";

export function DeleteSiteButton({ siteId, domain }: { siteId: string; domain: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Delete ${domain} and all of its crawler data? This can't be undone.`)) {
          start(() => deleteSite(siteId));
        }
      }}
      className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-critical hover:bg-surface-2 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete site"}
    </button>
  );
}
