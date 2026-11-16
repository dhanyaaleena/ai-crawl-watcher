export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-surface-2" />
      <div className="h-8 w-80 rounded bg-surface-2" />
      <div className="h-24 rounded-xl bg-surface-2" />
      <div className="h-72 rounded-xl bg-surface-2" />
    </div>
  );
}
