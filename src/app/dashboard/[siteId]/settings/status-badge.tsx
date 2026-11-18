export type SetupStatus = "Connected" | "Live" | "Ready" | "Optional" | "Waiting" | "Listening";

/** Small status label: green for working, neutral otherwise. Word + colour, never colour alone. */
export function StatusBadge({ status }: { status: SetupStatus }) {
  const good = status === "Connected" || status === "Live";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        good ? "bg-good-soft text-good-ink" : "bg-surface-2 text-ink-2"
      }`}
    >
      {status === "Listening" && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-good opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
        </span>
      )}
      {status}
    </span>
  );
}
