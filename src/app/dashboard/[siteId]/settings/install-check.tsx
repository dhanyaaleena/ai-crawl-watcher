"use client";

import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { checkInstall, type InstallCheck } from "./actions";

export function InstallCheckButton({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState<InstallCheck>(() => checkInstall(siteId), { status: "idle" });
  return (
    <div className="space-y-2">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Check installation
        </button>
      </form>
      {state.status !== "idle" && !pending && (
        <p role="status" className={`flex items-start gap-1.5 text-sm ${state.status === "found" ? "text-good-ink" : "text-ink-2"}`}>
          {state.status === "found" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" />}
          {state.message}
        </p>
      )}
    </div>
  );
}
