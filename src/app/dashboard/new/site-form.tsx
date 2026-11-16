"use client";

import { useActionState } from "react";
import { createSite, type NewSiteState } from "./actions";

export function SiteForm() {
  const [state, action, pending] = useActionState<NewSiteState, FormData>(createSite, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-ink-2">Website domain</span>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            name="domain"
            defaultValue={state.domain}
            placeholder="example.com"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add site"}
          </button>
        </div>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-critical">{state.error}</p>
      ) : (
        <p className="text-sm text-ink-3">Subdomains (www, blog, docs…) are tracked automatically.</p>
      )}
    </form>
  );
}
