/** Crawlwatch mark: a page with a scan line passing over it. */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--text)" />
      <rect x="9" y="7" width="14" height="18" rx="2" fill="none" stroke="var(--surface)" strokeWidth="2" />
      <path d="M12 12h8M12 16h5" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
      {/* The scan line carries the brand orange. */}
      <path d="M5 20h22" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
