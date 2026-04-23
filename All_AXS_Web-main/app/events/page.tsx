import { Metadata } from "next";
import Link from "next/link";
import { HomeQuickBrowseChips } from "@/components/home/HomeExtendedSections";
import {
  buildQuickFilterLinks,
  HOME_GENRE_LINKS,
} from "@/lib/home/derived-events";
import { fetchPublicEvents } from "@/lib/utils/api-server";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { EventsSearchSubmitButton } from "@/components/events/EventsSearchSubmitButton";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { buildEventsCatalogQueryString } from "@/lib/events/build-events-catalog-query";

export const revalidate = 60;

interface EventsPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    q?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    city?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: EventsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q;
  const title = query ? `Events — ${query} | All AXS` : "Events | All AXS";
  const description =
    "Browse upcoming experiences across Africa—concerts, summits, sport, and culture. Transparent tiers and instant QR delivery.";
  const SITE_BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_BASE_URL}/events${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      type: "website",
    },
    alternates: { canonical: `${SITE_BASE_URL}/events` },
  };
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const size = parseInt(params.size || "20", 10);

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
    console.error("Error fetching events:", error);
    eventsData = { events: [], total: 0, page: 1, size: 20 };
  }

  const { events, total, page: currentPage, size: pageSize } = eventsData;
  const totalPages = Math.ceil(total / pageSize);

  const quickFilterLinks = buildQuickFilterLinks();

  const catalogQueryBase = {
    q: params.q,
    type: params.type,
    city: params.city,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    size: params.size,
  };

  const hasActiveFilters = Boolean(
    params.q?.trim() ||
      params.type ||
      params.city ||
      params.dateFrom ||
      params.dateTo
  );

  return (
    <div className="axs-content-inner pb-16 md:pb-24">
      {/* One marketing shell: headline + filters + search share the same surface */}
      <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.09] bg-surface/35 ring-1 ring-white/[0.05]">
        <div
          className="pointer-events-none absolute inset-0 axs-hero-brand-glow opacity-[0.38]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.07] via-transparent to-transparent"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:p-9 lg:p-11">
            <header className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Events</p>
              <h1 className="mt-2 font-display text-[clamp(1.65rem,4vw+0.4rem,2.65rem)] font-semibold leading-[1.08] tracking-tight text-foreground md:mt-2.5 md:leading-[1.06]">
                <span className="block">Browse the full catalogue</span>
                <span className="axs-text-brand-gradient mt-1.5 block text-[clamp(1.85rem,5vw+0.2rem,3rem)] md:mt-2">
                  All AXS
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-[17px]">
                Refine with chips or search—each card shows format, date, venue, and the lowest tier.
              </p>
            </header>
            {total > 0 ? (
              <div className="flex flex-col items-start gap-0.5 rounded-[var(--radius-card)] border border-white/[0.08] bg-black/25 px-5 py-4 text-left md:items-end md:text-right">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Showing
                </span>
                <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {events.length}
                  <span className="text-lg font-medium text-muted sm:text-xl"> / {total}</span>
                </p>
                <span className="text-xs text-muted">on this page</span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/[0.08] px-6 py-6 md:px-9 md:py-7 lg:px-11">
            <HomeQuickBrowseChips
              quickFilterLinks={quickFilterLinks}
              genreLinks={HOME_GENRE_LINKS}
              eyebrow="Refine"
              sectionClassName="mb-0"
              variant="catalogue"
            />
          </div>

          <div className="border-t border-white/[0.08] px-6 pb-7 pt-2 md:px-9 md:pb-8 lg:px-11">
            <form
              method="GET"
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3"
              role="search"
            >
              <input type="hidden" name="page" value="1" />
              <label className="sr-only" htmlFor="events-catalog-search">
                Search events
              </label>
              <input
                id="events-catalog-search"
                type="text"
                name="q"
                placeholder="Artist, city, venue, keyword…"
                defaultValue={params.q || ""}
                className="min-h-12 w-full flex-1 rounded-[var(--radius-button)] border border-white/[0.1] bg-black/30 px-4 py-3 text-sm text-foreground shadow-inner shadow-black/20 placeholder:text-muted/80 focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-h-11 sm:px-5"
                aria-label="Search events"
              />
              <EventsSearchSubmitButton />
            </form>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-dashed border-white/[0.12] bg-surface/30 px-8 py-16 text-center ring-1 ring-white/[0.04] md:mt-12 md:py-20">
          <p className="mb-2 text-lg text-muted">
            {params.q ? `Nothing matched “${params.q}” yet.` : "No published events right now."}
          </p>
          {params.q ? (
            <Link href="/events" className="font-semibold text-primary hover:underline">
              Clear search
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-9 md:mt-11">
          <div className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{total}</span>{" "}
              {total === 1 ? "event" : "events"}
              {hasActiveFilters ? " match your filters" : " in the catalogue"}
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
                href="/events"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
            {events.map((event) => (
              <PublicEventCard key={event.id} event={event} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-white/[0.06] pt-9 md:mt-12 md:pt-10"
              aria-label="Pagination"
            >
              {currentPage > 1 && (
                <ArrowCtaLink
                  href={`/events?${buildEventsCatalogQueryString(catalogQueryBase, currentPage - 1)}`}
                  variant="outline"
                  size="compact"
                >
                  Previous
                </ArrowCtaLink>
              )}
              {currentPage < totalPages && (
                <ArrowCtaLink
                  href={`/events?${buildEventsCatalogQueryString(catalogQueryBase, currentPage + 1)}`}
                  variant="outline"
                  size="compact"
                >
                  Next
                </ArrowCtaLink>
              )}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
