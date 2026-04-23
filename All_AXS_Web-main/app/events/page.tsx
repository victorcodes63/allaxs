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

  return (
    <div className="space-y-12 pb-8">
      <div className="max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Catalogue</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight text-foreground">
          Find your next live moment
        </h1>
        <p className="text-lg text-muted leading-relaxed">
          Search by name or scroll the grid. Every card shows date, venue, and the lowest tier—so you
          know where you stand before you tap through.
        </p>
      </div>

      <HomeQuickBrowseChips
        quickFilterLinks={quickFilterLinks}
        genreLinks={HOME_GENRE_LINKS}
      />

      <form
        method="GET"
        className="flex flex-col sm:flex-row gap-3 max-w-xl"
        role="search"
      >
        <input type="hidden" name="page" value="1" />
        <input
          type="text"
          name="q"
          placeholder="Artist, city, venue, keyword…"
          defaultValue={params.q || ""}
          className="flex-1 rounded-[var(--radius-button)] border border-border bg-surface px-5 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Search events"
        />
        <EventsSearchSubmitButton />
      </form>

      {events.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-20 text-center">
          <p className="text-lg text-muted mb-2">
            {params.q ? `Nothing matched “${params.q}” yet.` : "No published events right now."}
          </p>
          {params.q ? (
            <Link href="/events" className="text-primary font-semibold hover:underline">
              Clear search
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            Showing{" "}
            <span className="font-medium text-foreground">
              {events.length} of {total}
            </span>{" "}
            events
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {events.map((event) => (
              <PublicEventCard key={event.id} event={event} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pt-6" aria-label="Pagination">
              {currentPage > 1 && (
                <ArrowCtaLink
                  href={`/events?${(() => {
                    const qs = new URLSearchParams();
                    if (params.q) qs.set("q", params.q);
                    if (params.type) qs.set("type", params.type);
                    if (params.city) qs.set("city", params.city);
                    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
                    if (params.dateTo) qs.set("dateTo", params.dateTo);
                    if (params.size) qs.set("size", params.size);
                    qs.set("page", String(currentPage - 1));
                    return qs.toString();
                  })()}`}
                  variant="outline"
                  size="compact"
                >
                  Previous
                </ArrowCtaLink>
              )}
              <span className="text-sm text-muted px-2">
                Page {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages && (
                <ArrowCtaLink
                  href={`/events?${(() => {
                    const qs = new URLSearchParams();
                    if (params.q) qs.set("q", params.q);
                    if (params.type) qs.set("type", params.type);
                    if (params.city) qs.set("city", params.city);
                    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
                    if (params.dateTo) qs.set("dateTo", params.dateTo);
                    if (params.size) qs.set("size", params.size);
                    qs.set("page", String(currentPage + 1));
                    return qs.toString();
                  })()}`}
                  variant="outline"
                  size="compact"
                >
                  Next
                </ArrowCtaLink>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
