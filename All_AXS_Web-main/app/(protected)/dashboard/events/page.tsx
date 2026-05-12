import Link from "next/link";
import { HomeQuickBrowseChips } from "@/components/home/HomeExtendedSections";
import { buildQuickFilterLinks, HOME_GENRE_LINKS } from "@/lib/home/derived-events";
import { fetchPublicEvents } from "@/lib/utils/api-server";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { EventsSearchSubmitButton } from "@/components/events/EventsSearchSubmitButton";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { buildEventsCatalogQueryString } from "@/lib/events/build-events-catalog-query";

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
  const quickFilterLinks = buildQuickFilterLinks();

  const queryBase = {
    q: params.q,
    type: params.type,
    city: params.city,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    size: params.size,
  };

  const hasActiveFilters = Boolean(
    params.q?.trim() || params.type || params.city || params.dateFrom || params.dateTo
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/65 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="border-b border-border/70 px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Attendee events</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Discover upcoming events
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            This catalogue is tailored for signed-in attendees. Open an event to view details and
            buy passes to your wallet.
          </p>
        </div>

        <div className="border-b border-border/70 px-5 py-5 sm:px-7">
          <HomeQuickBrowseChips
            quickFilterLinks={quickFilterLinks}
            genreLinks={HOME_GENRE_LINKS}
            eyebrow="Refine"
            sectionClassName="mb-0"
            variant="catalogue"
          />
        </div>

        <div className="px-5 py-5 sm:px-7">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
            <input type="hidden" name="page" value="1" />
            <label className="sr-only" htmlFor="dashboard-events-search">
              Search events
            </label>
            <input
              id="dashboard-events-search"
              type="text"
              name="q"
              placeholder="Artist, city, venue, keyword..."
              defaultValue={params.q || ""}
              className="min-h-11 w-full flex-1 rounded-[var(--radius-button)] border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/80 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Search events"
            />
            <EventsSearchSubmitButton />
          </form>
        </div>
      </section>

      {events.length === 0 ? (
        <section className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/40 px-8 py-16 text-center">
          <p className="text-lg text-muted">
            {params.q ? `No events matched "${params.q}" yet.` : "No published events available right now."}
          </p>
          {hasActiveFilters ? (
            <Link
              href="/dashboard/events"
              className="mt-3 inline-flex text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              Clear filters
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{total}</span>{" "}
              {total === 1 ? "event" : "events"}
              {hasActiveFilters ? " match your filters" : " available now"}
              {totalPages > 1 ? (
                <>
                  {" "}
                  · page{" "}
                  <span className="font-medium text-foreground">
                    {currentPage} of {totalPages}
                  </span>
                </>
              ) : null}
            </p>
            {hasActiveFilters ? (
              <Link
                href="/dashboard/events"
                className="text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <PublicEventCard
                key={event.id}
                event={event}
                eventHref={`/dashboard/events/${event.slug}`}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="flex flex-wrap items-center justify-center gap-3 pt-2" aria-label="Pagination">
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
