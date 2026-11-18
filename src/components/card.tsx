import type { ReactNode } from "react";

/**
 * A bordered panel. The header reads "Title · subtitle" with an optional icon,
 * and an optional footer carries a one-line caption (Searchable's card style).
 */
export function Card({
  title,
  subtitle,
  icon,
  action,
  footer,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && (
            <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              {icon && <span className="shrink-0 text-ink-3 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
              <span className="truncate">
                {title}
                {subtitle && <span className="font-normal text-ink-3"> · {subtitle}</span>}
              </span>
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={`flex-1 ${flush ? "" : "px-5 py-4"}`}>{children}</div>
      {footer && <div className="border-t border-line bg-surface-2/60 px-5 py-2.5 text-xs text-ink-3">{footer}</div>}
    </section>
  );
}
