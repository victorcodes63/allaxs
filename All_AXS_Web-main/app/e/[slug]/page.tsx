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
import { ArrowBackCtaLink, ArrowCtaLink } from "@/components/ui/ArrowCta";

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

function formatPriceDisplay(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatSchedule(startAt: string, endAt: string): {
  headlineDate: string;
  timeRange: string;
  durationHint: string | null;
} {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const headlineDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const sameDay = start.toDateString() === end.toDateString();
  const timeRange = sameDay
    ? `${timeFmt.format(start)} – ${timeFmt.format(end)}`
    : `${timeFmt.format(start)} · ${headlineDate} → ${timeFmt.format(end)} · ${new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(end)}`;
  const durationMs = end.getTime() - start.getTime();
  const durationMins = Math.round(durationMs / 60000);
  let durationHint: string | null = null;
  if (sameDay && durationMins >= 45 && durationMins <= 18 * 60) {
    if (durationMins < 120) {
      durationHint = `${durationMins} minutes`;
    } else {
      const h = Math.round(durationMins / 60);
      durationHint = `About ${h} hour${h === 1 ? "" : "s"}`;
    }
  }
  return { headlineDate, timeRange, durationHint };
}

function formatWhereLine(event: PublicEvent): string | null {
  const place = [event.venue, event.city, event.country].filter(Boolean).join(" · ");
  if (event.type === "VIRTUAL") {
    return place ? `Online · ${place}` : "Online";
  }
  if (event.type === "HYBRID") {
    if (!place) return "Hybrid · in person and online";
    return `${place} · streamed online`;
  }
  return place || null;
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

  const eventUrl = `${SITE_BASE_URL}/e/${event.slug}`;
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
    ...(event.type === "VIRTUAL" && !event.venue
      ? {
          location: {
            "@type": "VirtualLocation",
            url: eventUrl,
          },
        }
      : event.venue || event.city || event.country
        ? {
            location: {
              "@type": "Place",
              name: event.venue || event.city || "Event venue",
              ...(event.city && { addressLocality: event.city }),
              ...(event.country && { addressCountry: event.country }),
            },
          }
        : {}),
    ...(minPrice !== null && {
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
  const schedule = formatSchedule(event.startAt, event.endAt);
  const whereLine = formatWhereLine(event);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="axs-content-inner space-y-8 pb-12 md:space-y-10 md:pb-16">
        <nav
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
          aria-label="Breadcrumb"
        >
          <Link
            href="/events"
            className="font-medium text-muted transition-colors hover:text-foreground"
          >
            Events
          </Link>
          <span className="text-muted/50" aria-hidden>
            /
          </span>
          <span className="line-clamp-2 max-w-[min(100%,42rem)] text-foreground/70">{event.title}</span>
        </nav>

        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[var(--radius-panel)] bg-foreground/5 aspect-[2/3] max-h-[min(88dvh,720px)] shadow-[0_28px_90px_-36px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 md:max-h-[440px] md:max-w-4xl md:aspect-[5/3]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />
          <div className="absolute bottom-0 left-0 right-0 max-w-4xl p-6 text-white md:p-10">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
              {getTypeLabel(event.type)}
            </p>
            <h1 className="font-display text-3xl leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
              {event.title}
            </h1>
            <dl className="mt-5 space-y-1.5 text-sm text-white/88 sm:text-[15px]">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <dt className="sr-only">Date</dt>
                <dd className="font-medium text-white/95">{schedule.headlineDate}</dd>
              </div>
              <div>
                <dt className="sr-only">Time</dt>
                <dd className="text-white/82">{schedule.timeRange}</dd>
                {schedule.durationHint && (
                  <dd className="mt-0.5 text-xs text-white/60">Runs {schedule.durationHint}</dd>
                )}
              </div>
              {whereLine && (
                <div>
                  <dt className="sr-only">Location</dt>
                  <dd className="text-white/82">{whereLine}</dd>
                </div>
              )}
            </dl>
            {minPrice !== null && (
              <p className="mt-4 text-base font-semibold text-primary sm:text-lg">
                From {formatPriceDisplay(minPrice, currency)}
              </p>
            )}
          </div>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
          <aside
            aria-label="Tickets and checkout"
            className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1"
          >
            <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-sm">
              <div className="border-b border-border bg-wash/80 p-6">
                <h2 className="font-display text-xl font-semibold text-foreground sm:text-[1.35rem]">
                  Tickets
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Choose your tier here. Quantities and fees are confirmed on the next screen before you pay.
                </p>
              </div>
              <ul className="max-h-[min(50vh,360px)] divide-y divide-border overflow-y-auto overscroll-contain lg:max-h-[320px]">
                {activeTiers.length === 0 ? (
                  <li className="p-6 text-sm leading-relaxed text-muted">
                    There are no passes on sale at the moment. Check back soon, or explore other dates on the
                    catalogue.
                  </li>
                ) : (
                  activeTiers.map((tier) => {
                    const left =
                      (tier.quantityTotal ?? 0) - (tier.quantitySold ?? 0);
                    const total = tier.quantityTotal ?? 0;
                    const almostGone =
                      left > 0 &&
                      total > 0 &&
                      (left <= 20 || left / total <= 0.12);
                    const minO = tier.minPerOrder ?? 1;
                    const maxO = tier.maxPerOrder;
                    const limits =
                      minO > 1 || maxO
                        ? [
                            minO > 1 ? `Min ${minO} per order` : null,
                            maxO ? `Up to ${maxO} per order` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : null;
                    return (
                      <li
                        key={tier.id}
                        className="p-5 transition-colors hover:bg-background/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground">{tier.name}</p>
                            {tier.description && (
                              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                                {tier.description}
                              </p>
                            )}
                            {limits && (
                              <p className="mt-2 text-xs text-muted">{limits}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                          <span className="text-lg font-bold tabular-nums text-primary sm:text-xl">
                            {formatPriceDisplay(tier.priceCents, tier.currency)}
                          </span>
                          <span
                            className={
                              almostGone
                                ? "text-xs font-medium tabular-nums text-primary/90"
                                : "text-xs tabular-nums text-muted"
                            }
                          >
                            {left > 0
                              ? almostGone
                                ? `${left} left · selling fast`
                                : `${left} left`
                              : "Sold out"}
                          </span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="bg-background/60 p-6">
                <ArrowCtaLink
                  href={`/events/${event.id}/checkout`}
                  variant="primary"
                  fullWidth
                  aria-label={`Buy tickets for ${event.title}`}
                >
                  Continue to checkout
                </ArrowCtaLink>
                <p className="mt-3 px-1 text-center text-xs leading-relaxed text-muted">
                  Sign in or create an account to save passes to My tickets, or continue as a guest and get details by
                  email / WhatsApp. Demo checkout delivers QR passes instantly on this device.
                </p>
                <div className="mt-4 flex justify-center">
                  <ArrowBackCtaLink href="/events" size="compact" aria-label="Back to all events">
                    All events
                  </ArrowBackCtaLink>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-1">
            <section className="max-w-none scroll-mt-28" aria-labelledby="about-heading">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Overview</p>
              <h2
                id="about-heading"
                className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
              >
                About this experience
              </h2>
              {event.description ? (
                <p className="mt-4 whitespace-pre-wrap text-base leading-[1.65] text-foreground/88 sm:text-lg">
                  {event.description}
                </p>
              ) : (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                  Detailed program notes are on the way. Reserve your place now — we’ll email you as the
                  organizer publishes more information.
                </p>
              )}
            </section>

            <section
              className="rounded-[var(--radius-card)] border border-border bg-gradient-to-b from-primary/[0.08] to-surface p-6 sm:p-7"
              aria-labelledby="organizer-name"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Presented by</p>
              <p id="organizer-name" className="font-display mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                {event.organizer.orgName}
              </p>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                Ticketing on All AXS — clear tiers, secure checkout where enabled, and instant digital passes when
                your order completes.
              </p>
            </section>
          </div>
        </div>
      </article>
    </>
  );
}
