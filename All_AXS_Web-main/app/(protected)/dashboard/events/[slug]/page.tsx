import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchEventBySlug } from "@/lib/utils/api-server";
import {
  generatePlaceholderImage,
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

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

function getTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatEventWhen(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (start.toDateString() === end.toDateString()) return `${day} · ${startTime} - ${endTime}`;
  const endDay = end.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} · ${startTime} → ${endDay} · ${endTime}`;
}

function isTierAvailable(tier: { status?: string; quantityTotal?: number; quantitySold?: number }) {
  if (tier.status && tier.status !== "ACTIVE") return false;
  const total = tier.quantityTotal ?? 0;
  const sold = tier.quantitySold ?? 0;
  return total - sold > 0;
}

export default async function DashboardEventDetailPage({ params }: Props) {
  const { slug } = await params;
  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);
  const minPrice =
    event.ticketTypes && event.ticketTypes.length > 0
      ? Math.min(...event.ticketTypes.map((t) => t.priceCents))
      : null;
  const currency =
    event.ticketTypes && event.ticketTypes.length > 0 ? event.ticketTypes[0].currency : "KES";
  const availableTiers = event.ticketTypes?.filter(isTierAvailable) ?? [];
  const location = [event.venue, event.city, event.country].filter(Boolean).join(" · ");

  return (
    <article className="space-y-7 pb-8">
      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href="/dashboard/events" className="font-medium text-muted hover:text-foreground">
          Events
        </Link>
        <span aria-hidden>/</span>
        <span className="line-clamp-1 text-foreground/75">{event.title}</span>
      </nav>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
        <div className="relative h-56 sm:h-72 lg:h-80">
          <Image
            src={event.bannerUrl ? bannerUrl : placeholderUrl}
            alt={event.title}
            fill
            className="object-cover object-top"
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            unoptimized={shouldUnoptimizeEventImage(event.bannerUrl ? bannerUrl : placeholderUrl)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
              {getTypeLabel(event.type)}
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.08] tracking-tight text-white sm:text-4xl">
              {event.title}
            </h1>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">When</p>
              <p className="mt-1.5 text-sm font-medium text-foreground">{formatEventWhen(event.startAt, event.endAt)}</p>
            </div>
            {location ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Where</p>
                <p className="mt-1.5 text-sm text-foreground">{location}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">About</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {event.description || "More event details will be announced soon."}
              </p>
            </div>
          </div>

          <aside className="rounded-[var(--radius-card)] border border-border bg-background p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">Tickets</h2>
            {minPrice !== null ? (
              <p className="mt-1 text-sm text-muted">
                From <span className="font-semibold text-primary">{formatPriceDisplay(minPrice, currency)}</span>
              </p>
            ) : null}
            <ul className="mt-4 space-y-3 border-t border-border/70 pt-4">
              {availableTiers.length === 0 ? (
                <li className="text-sm text-muted">No active tiers at the moment.</li>
              ) : (
                availableTiers.map((tier) => (
                  <li key={tier.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-foreground">{tier.name}</span>
                    <span className="shrink-0 font-medium text-muted">
                      {formatPriceDisplay(tier.priceCents, tier.currency)}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <ArrowCtaLink
              href={`/dashboard/events/${event.slug}/checkout`}
              variant="primary"
              fullWidth
              className="mt-5"
            >
              Buy tickets
            </ArrowCtaLink>
          </aside>
        </div>
      </section>
    </article>
  );
}
