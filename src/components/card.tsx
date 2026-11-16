import type { ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          {title && <h2 className="text-sm font-medium text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className={flush ? "" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}
