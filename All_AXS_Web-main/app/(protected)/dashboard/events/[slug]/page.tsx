import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEventBySlug } from "@/lib/utils/api-server";
import {
  generatePlaceholderImage,
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { EventDetailQuickActions } from "@/components/events/EventDetailQuickActions";
import { SavedEventButton } from "@/components/events/SavedEventButton";
import { EventDetailTicketsAside } from "@/components/events/EventDetailTicketsAside";
import { hubLegalHref } from "@/lib/legal/hub-paths";
import {
  formatPriceDisplay,
  formatSchedule,
  formatStartsIn,
  formatWhereLine,
  getTypeLabel,
  mapsSearchUrl,
} from "@/lib/events/event-detail-format";
import { resolveCurrencyFromTiers } from "@/lib/currency";
import { platformSupportMailto } from "@/lib/site-contact";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function DashboardEventDetailPage({ params }: Props) {
  const { slug } = await params;
  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  const publicEventUrl = `${siteBase.replace(/\/$/, "")}/e/${event.slug}`;

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);
  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t) => t.priceCents))
      : null;
  const currency = resolveCurrencyFromTiers(event.ticketTypes);
  const schedule = formatSchedule(event.startAt, event.endAt);
  const whereLine = formatWhereLine(event);
  const startsIn = formatStartsIn(event.startAt);
  const mapsUrl =
    event.type === "VIRTUAL" ? null : mapsSearchUrl(event);

  return (
    <article className="space-y-8 pb-12">
      <nav
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
        aria-label="Breadcrumb"
      >
        <Link href="/dashboard/events" className="font-medium hover:text-foreground">
          Browse events
        </Link>
        <span aria-hidden>/</span>
        <span className="line-clamp-2 max-w-[min(100%,42rem)] text-foreground/75">
          {event.title}
        </span>
      </nav>

      <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <div className="relative aspect-[16/9] max-h-[min(52vh,420px)] w-full sm:aspect-[21/9]">
          <Image
            src={event.bannerUrl ? bannerUrl : placeholderUrl}
            alt=""
            fill
            className="object-cover object-top"
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            unoptimized={shouldUnoptimizeEventImage(event.bannerUrl ? bannerUrl : placeholderUrl)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-black/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
                {getTypeLabel(event.type)}
              </span>
              {startsIn ? (
                <span className="rounded-full border border-primary/40 bg-primary/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {startsIn}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
              {event.title}
            </h1>
            <dl className="mt-4 space-y-1 text-sm text-white/88 sm:text-[15px]">
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-medium text-white/95">{schedule.headlineDate}</dd>
              </div>
              <div>
                <dt className="sr-only">Time</dt>
                <dd>{schedule.timeRange}</dd>
                {schedule.durationHint ? (
                  <dd className="mt-0.5 text-xs text-white/65">Runs {schedule.durationHint}</dd>
                ) : null}
              </div>
              {whereLine ? (
                <div>
                  <dt className="sr-only">Location</dt>
                  <dd>{whereLine}</dd>
                </div>
              ) : null}
            </dl>
            {minPrice !== null ? (
              <p className="mt-4 text-base font-semibold text-primary sm:text-lg">
                From {formatPriceDisplay(minPrice, currency)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <EventDetailQuickActions
          title={event.title}
          startIso={event.startAt}
          endIso={event.endAt}
          location={whereLine}
          description={event.description}
          shareUrl={publicEventUrl}
          mapsUrl={mapsUrl}
        />
        <SavedEventButton slug={event.slug} variant="inline" />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Event essentials">
            <div className="rounded-[var(--radius-card)] border border-border bg-surface/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">When</p>
              <p className="mt-2 text-sm font-medium text-foreground">{schedule.headlineDate}</p>
              <p className="mt-1 text-sm text-muted">{schedule.timeRange}</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border bg-surface/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Format</p>
              <p className="mt-2 text-sm font-medium text-foreground">{getTypeLabel(event.type)}</p>
              <p className="mt-1 text-sm text-muted">
                {event.type === "HYBRID"
                  ? "Join in person or online"
                  : event.type === "VIRTUAL"
                    ? "Join from anywhere"
                    : "In-person experience"}
              </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border bg-surface/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Where</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {whereLine ?? "Venue to be announced"}
              </p>
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Get directions →
                </a>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="about-heading">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Overview</p>
            <h2
              id="about-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              About this experience
            </h2>
            {event.description ? (
              <p className="mt-4 whitespace-pre-wrap text-base leading-[1.65] text-foreground/90">
                {event.description}
              </p>
            ) : (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                The organizer has not published full program notes yet. Reserve your place now — we
                will email you when more details are available.
              </p>
            )}
          </section>

          <section
            className="rounded-[var(--radius-card)] border border-border bg-gradient-to-b from-primary/[0.08] to-surface p-5 sm:p-6"
            aria-labelledby="organizer-name"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Presented by</p>
            <p id="organizer-name" className="mt-2 font-display text-xl font-semibold text-foreground">
              {event.organizer.orgName}
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
              Ticketing on All AXS — clear tiers, secure checkout, and digital passes in your wallet
              when your order completes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <a
                href={publicEventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                View public event page
              </a>
              <Link
                href={hubLegalHref("/dashboard", "refund-policy")}
                className="font-medium text-foreground/80 underline decoration-border underline-offset-4 hover:text-foreground"
              >
                Refund policy
              </Link>
            </div>
          </section>

          <section
            className="rounded-[var(--radius-card)] border border-border bg-surface/70 p-5 sm:p-6"
            aria-labelledby="good-to-know-heading"
          >
            <h2
              id="good-to-know-heading"
              className="text-xs font-semibold uppercase tracking-widest text-muted"
            >
              Good to know
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>Your QR pass appears in My tickets after checkout — we also email a PDF backup.</li>
              <li>For hybrid events, choose the tier that matches how you plan to attend.</li>
              <li>
                Questions about this event?{" "}
                <a
                  href={platformSupportMailto({ subject: "Question about event" })}
                  className="font-medium text-primary hover:underline"
                >
                  Email support
                </a>{" "}
                and include the event name.
              </li>
            </ul>
          </section>
        </div>

        <EventDetailTicketsAside
          event={event}
          checkoutHref={`/dashboard/events/${event.slug}/checkout`}
          minPrice={minPrice}
          refundPolicyHref={hubLegalHref("/dashboard", "refund-policy")}
          supportHref="/dashboard/support"
        />
      </div>
    </article>
  );
}
