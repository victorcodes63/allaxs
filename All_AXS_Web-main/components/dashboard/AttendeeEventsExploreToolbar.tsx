import Link from "next/link";
import {
  activeCatalogFilterLabels,
  isCatalogFilterActive,
  type CatalogFilterLink,
  type EventsCatalogFilterParams,
} from "@/lib/dashboard/events-catalog-filters";
import { EventsSearchSubmitButton } from "@/components/events/EventsSearchSubmitButton";

type AttendeeEventsExploreToolbarProps = {
  current: EventsCatalogFilterParams;
  quickFilters: CatalogFilterLink[];
  genreFilters: CatalogFilterLink[];
  defaultQuery?: string;
};

function FilterChip({
  href,
  label,
  active,
  tone = "when",
}: {
  href: string;
  label: string;
  active: boolean;
  tone?: "when" | "vibe";
}) {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors";
  const activeClass =
    tone === "when"
      ? "border-primary/55 bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(240,114,65,0.12)_inset]"
      : "border-primary/45 bg-primary/10 text-primary";
  const idleClass =
    tone === "when"
      ? "border-border/80 bg-background/50 text-foreground/95 hover:border-primary/40 hover:bg-primary/[0.06]"
      : "border-border/70 bg-background/35 text-foreground/90 hover:border-primary/35 hover:text-primary";

  return (
    <Link href={href} className={`${base} ${active ? activeClass : idleClass}`} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}

export function AttendeeEventsExploreToolbar({
  current,
  quickFilters,
  genreFilters,
  defaultQuery = "",
}: AttendeeEventsExploreToolbarProps) {
  const hasActiveFilters = Boolean(
    current.q?.trim() ||
      current.type ||
      current.city ||
      current.dateFrom ||
      current.dateTo,
  );
  const activeLabels = activeCatalogFilterLabels(quickFilters, genreFilters, current);

  return (
    <section
      aria-label="Search and filter events"
      className="rounded-[var(--radius-panel)] border border-border bg-surface/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
    >
      <div className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
        <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-stretch" role="search">
          <input type="hidden" name="page" value="1" />
          {current.type ? <input type="hidden" name="type" value={current.type} /> : null}
          {current.city ? <input type="hidden" name="city" value={current.city} /> : null}
          {current.dateFrom ? <input type="hidden" name="dateFrom" value={current.dateFrom} /> : null}
          {current.dateTo ? <input type="hidden" name="dateTo" value={current.dateTo} /> : null}
          <label className="sr-only" htmlFor="dashboard-events-search">
            Search events
          </label>
          <div className="relative min-w-0 flex-1">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="dashboard-events-search"
              type="search"
              name="q"
              placeholder="Search artist, city, venue, or keyword…"
              defaultValue={defaultQuery}
              className="min-h-[var(--btn-min-h)] w-full rounded-[var(--radius-button)] border border-border/80 bg-background py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted/75 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Search events"
            />
          </div>
          <EventsSearchSubmitButton />
        </form>

        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-[0.12em] text-muted">Active</span>
            {activeLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 font-medium text-primary"
              >
                {label}
              </span>
            ))}
            <Link
              href="/dashboard/events"
              className="ml-auto font-semibold uppercase tracking-[0.1em] text-primary hover:underline"
            >
              Clear all
            </Link>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">When</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {quickFilters.map((item) => (
              <FilterChip
                key={item.href}
                href={item.href}
                label={item.label}
                active={isCatalogFilterActive(item.href, current)}
                tone="when"
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Vibes</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {genreFilters.map((item) => (
              <FilterChip
                key={item.href}
                href={item.href}
                label={item.label}
                active={isCatalogFilterActive(item.href, current)}
                tone="vibe"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
