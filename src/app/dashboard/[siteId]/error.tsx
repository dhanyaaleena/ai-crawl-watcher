"use client";

export default function SiteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-8 text-center">
      <h2 className="font-medium">Couldn’t load crawler data</h2>
      <p className="mt-1 text-sm text-ink-3">{error.message || "Something went wrong."}</p>
      <button onClick={reset} className="mt-4 rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-surface-2">
        Try again
      </button>
    </div>
  );
}
