/** Crawlwatch mark: a "C" that doubles as a watching eye, with an orange pupil. */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--text)" />
      <path d="M22.51 10.54A8.5 8.5 0 1 0 22.51 21.46" fill="none" stroke="var(--surface)" strokeWidth="3.6" strokeLinecap="round" />
      {/* The pupil carries the brand orange. */}
      <circle cx="16" cy="16" r="3" fill="var(--brand)" />
    </svg>
  );
}
