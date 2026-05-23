import Link from "next/link";
import {
  buildDashboardGenreLinks,
  buildDashboardQuickFilterLinks,
} from "@/lib/dashboard/events-catalog-filters";
import { fetchPublicEvents } from "@/lib/utils/api-server";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { buildEventsCatalogQueryString } from "@/lib/events/build-events-catalog-query";
import { AttendeeEventsExploreToolbar } from "@/components/dashboard/AttendeeEventsExploreToolbar";

export const revalidate = 60;

type AttendeeEventsPageProps = {
  searchParams: Promise<{
    page?: string;
    size?: string;
    q?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    city?: string;
  }>;
};

export default async function AttendeeEventsPage({ searchParams }: AttendeeEventsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const size = parseInt(params.size || "12", 10);

  let eventsData;
  try {
    eventsData = await fetchPublicEvents({
      page,
      size,
      q: params.q,
      type: params.type,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      city: params.city,
    });
  } catch (error) {
    console.error("Error fetching attendee events:", error);
    eventsData = { events: [], total: 0, page: 1, size: 12 };
  }

  const { events, total, page: currentPage, size: pageSize } = eventsData;
  const totalPages = Math.ceil(total / pageSize);
  const quickFilterLinks = buildDashboardQuickFilterLinks();
  const genreLinks = buildDashboardGenreLinks();

  const queryBase = {
    q: params.q,
    type: params.type,
    city: params.city,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    size: params.size,
  };

  const currentFilters = {
    q: params.q,
    type: params.type,
    city: params.city,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  const hasActiveFilters = Boolean(
    params.q?.trim() || params.type || params.city || params.dateFrom || params.dateTo,
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Discover
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Browse events
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Find your next show, filter by date or format, and checkout straight into your wallet.
        </p>
      </header>

      <AttendeeEventsExploreToolbar
        current={currentFilters}
        quickFilters={quickFilterLinks}
        genreFilters={genreLinks}
        defaultQuery={params.q || ""}
      />

      {events.length === 0 ? (
        <section className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/40 px-6 py-14 text-center sm:px-10 sm:py-16">
          <p className="text-lg font-medium text-foreground">
            {params.q ? `No events matched “${params.q}”` : "No published events right now"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Try a different keyword, widen the date range, or clear filters to see everything live.
          </p>
          {hasActiveFilters ? (
            <Link
              href="/dashboard/events"
              className="mt-5 inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/45"
            >
              Clear filters
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Showing{" "}
              <span className="font-semibold text-foreground">{events.length}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>{" "}
              {total === 1 ? "event" : "events"}
              {hasActiveFilters ? " matching your filters" : ""}
              {totalPages > 1 ? (
                <>
                  {" "}
                  · page{" "}
                  <span className="font-semibold text-foreground">
                    {currentPage} of {totalPages}
                  </span>
                </>
              ) : null}
            </p>
            {hasActiveFilters ? (
              <Link
                href="/dashboard/events"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <PublicEventCard
                key={event.id}
                event={event}
                eventHref={`/dashboard/events/${event.slug}`}
                saveSlug={event.slug}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-3 border-t border-border/70 pt-6"
              aria-label="Pagination"
            >
              {currentPage > 1 ? (
                <ArrowCtaLink
                  href={`/dashboard/events?${buildEventsCatalogQueryString(queryBase, currentPage - 1)}`}
                  variant="outline"
                  size="compact"
                >
                  Previous
                </ArrowCtaLink>
              ) : null}
              {currentPage < totalPages ? (
                <ArrowCtaLink
                  href={`/dashboard/events?${buildEventsCatalogQueryString(queryBase, currentPage + 1)}`}
                  variant="outline"
                  size="compact"
                >
                  Next
                </ArrowCtaLink>
              ) : null}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
