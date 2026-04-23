import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEventBySlug, type PublicEvent } from "@/lib/utils/api-server";
import {
  getEventBannerAbsoluteUrl,
  getEventBannerUrl,
  generatePlaceholderImage,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

export const revalidate = 300;

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EventDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    return {
      title: "Event Not Found | All AXS",
      description: "The event you are looking for does not exist.",
    };
  }
  const SITE_BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  const title = `${event.title} | All AXS`;
  const description = event.description
    ? event.description.slice(0, 160).replace(/\n/g, " ")
    : `Join us for ${event.title}. ${event.venue ? `Location: ${event.venue}` : ""}`;
  const imageUrl = getEventBannerAbsoluteUrl(event.bannerUrl);
  const eventUrl = `${SITE_BASE_URL}/e/${event.slug}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: eventUrl,
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: event.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
    alternates: { canonical: eventUrl },
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function getEventAttendanceMode(type: string): string {
  switch (type) {
    case "IN_PERSON":
      return "OfflineEventAttendanceMode";
    case "VIRTUAL":
      return "OnlineEventAttendanceMode";
    case "HYBRID":
      return "MixedEventAttendanceMode";
    default:
      return "OfflineEventAttendanceMode";
  }
}

function isTierAvailable(tier: NonNullable<PublicEvent["ticketTypes"]>[0]) {
  if (tier.status && tier.status !== "ACTIVE") return false;
  const total = tier.quantityTotal ?? 0;
  const sold = tier.quantitySold ?? 0;
  return total - sold > 0;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug } = await params;
  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  const SITE_BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);

  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t) => t.priceCents))
      : null;
  const currency =
    event.ticketTypes && event.ticketTypes.length > 0
      ? event.ticketTypes[0].currency
      : "KES";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || event.title,
    startDate: event.startAt,
    endDate: event.endAt,
    eventAttendanceMode: `https://schema.org/${getEventAttendanceMode(event.type)}`,
    eventStatus: "https://schema.org/EventScheduled",
    image: event.bannerUrl ? [getEventBannerAbsoluteUrl(event.bannerUrl)] : [],
    organizer: { "@type": "Organization", name: event.organizer.orgName },
    ...(event.venue && {
      location: {
        "@type": "Place",
        name: event.venue,
        ...(event.city && { addressLocality: event.city }),
        ...(event.country && { addressCountry: event.country }),
      },
    }),
    ...(minPrice && {
      offers: {
        "@type": "Offer",
        price: minPrice / 100,
        priceCurrency: currency,
        availability: "https://schema.org/InStock",
        url: `${SITE_BASE_URL}/e/${event.slug}`,
      },
    }),
  };

  const activeTiers = event.ticketTypes?.filter(isTierAvailable) ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="space-y-10 md:space-y-14 pb-8">
        <div className="relative w-full max-w-xl mx-auto md:max-w-4xl aspect-[2/3] max-h-[min(88dvh,720px)] md:aspect-[5/3] md:max-h-[440px] rounded-[var(--radius-panel)] overflow-hidden bg-foreground/5">
          {event.bannerUrl ? (
            <Image
              src={bannerUrl}
              alt={event.title}
              fill
              className="object-cover object-top"
              priority
              sizes="(max-width: 768px) 100vw, 896px"
              unoptimized={shouldUnoptimizeEventImage(bannerUrl)}
            />
          ) : (
            <Image
              src={placeholderUrl}
              alt={event.title}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 896px"
              unoptimized={shouldUnoptimizeEventImage(placeholderUrl)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
              {getTypeLabel(event.type)}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight">
              {event.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/85">
              <span>{formatDate(event.startAt)}</span>
              {event.venue && (
                <span>
                  {event.venue}
                  {event.city ? ` · ${event.city}` : ""}
                  {event.country ? ` · ${event.country}` : ""}
                </span>
              )}
            </div>
            {minPrice !== null && (
              <p className="mt-3 text-lg font-semibold text-primary">
                From {minPrice / 100} {currency}
              </p>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">
          <div className="space-y-8">
            {event.description && (
              <div className="max-w-none">
                <h2 className="font-display text-2xl font-semibold text-foreground mb-4">About</h2>
                <p className="text-foreground/85 whitespace-pre-wrap leading-relaxed text-lg">
                  {event.description}
                </p>
              </div>
            )}

            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Presented by
              </p>
              <p className="font-display text-xl font-semibold text-foreground">{event.organizer.orgName}</p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 space-y-6">
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-wash/80">
                <h2 className="font-display text-xl font-semibold text-foreground">Ticket tiers</h2>
                <p className="text-sm text-muted mt-1">Select quantities on the next step—fees shown at checkout.</p>
              </div>
              <ul className="divide-y divide-border max-h-[320px] overflow-y-auto">
                {activeTiers.length === 0 ? (
                  <li className="p-6 text-sm text-muted">No tickets on sale right now.</li>
                ) : (
                  activeTiers.map((tier) => {
                    const left =
                      (tier.quantityTotal ?? 0) - (tier.quantitySold ?? 0);
                    return (
                      <li key={tier.id} className="p-5 hover:bg-background/50 transition-colors">
                        <p className="font-semibold text-foreground">{tier.name}</p>
                        {tier.description && (
                          <p className="text-sm text-muted mt-1 line-clamp-2">{tier.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-lg font-bold text-primary">
                            {tier.priceCents / 100} {tier.currency}
                          </span>
                          <span className="text-xs text-muted">
                            {left > 0 ? `${left} left` : "Sold out"}
                          </span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="p-6 bg-background/60">
                <ArrowCtaLink
                  href={`/events/${event.id}/checkout`}
                  variant="primary"
                  fullWidth
                  aria-label={`Buy tickets for ${event.title}`}
                >
                  Continue to checkout
                </ArrowCtaLink>
                <p className="mt-3 text-center text-xs text-muted">
                  Sign in required at checkout (demo payment, instant QR passes).
                </p>
                <Link
                  href="/events"
                  className="mt-3 block text-center text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  ← Back to events
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}
