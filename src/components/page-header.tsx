import { Download } from "lucide-react";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { filtersToQuery, type Filters } from "@/lib/filters";

export function PageHeader({
  title,
  description,
  siteId,
  filters,
  badge,
}: {
  title: string;
  description?: string;
  siteId?: string;
  filters?: Filters;
  /** Shown next to the title, e.g. the "Sample data" label. */
  badge?: React.ReactNode;
}) {
  const q = filters ? filtersToQuery(filters).replace(/^\?/, "&") : "";
  return (
    <header className="mb-6 space-y-4" data-page-header>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-normal tracking-[-0.035em]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      {filters && siteId && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense>
            <FilterBar />
          </Suspense>
          <a
            href={`/api/export?site=${siteId}${q}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
            title="Download the events matching these filters as CSV"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      )}
    </header>
  );
}
