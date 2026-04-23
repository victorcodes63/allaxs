import Image from "next/image";
import Link from "next/link";
import type { PublicEvent } from "@/lib/utils/api-server";
import {
  getEventBannerUrl,
  generatePlaceholderImage,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

export function PublicEventCard({
  event,
  variant = "default",
  className,
}: {
  event: PublicEvent;
  /** Compact: short banner rail. featuredRail: poster-like + details for home featured scroller. listRow: horizontal row (poster left). */
  variant?: "default" | "compact" | "featuredRail" | "listRow";
  className?: string;
}) {
  const compact = variant === "compact";
  const featuredRail = variant === "featuredRail";
  const listRow = variant === "listRow";
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

  if (listRow) {
    return (
      <Link
        href={`/e/${event.slug}`}
        className={[
          "group flex flex-row gap-4 overflow-hidden rounded-[var(--radius-card)] bg-surface/55 p-3.5 text-left ring-1 ring-white/[0.06] transition-[box-shadow,transform,background-color] duration-300 hover:bg-surface/70 hover:shadow-md active:scale-[0.995] sm:gap-5 sm:p-4",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`View event: ${event.title}`}
      >
        <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-foreground/5 sm:h-28 sm:w-28">
          {event.bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              sizes="112px"
              unoptimized={shouldUnoptimizeEventImage(bannerUrl)}
            />
          ) : (
            <Image
              src={placeholderUrl}
              alt=""
              fill
              className="object-cover object-top"
              sizes="112px"
              loading="lazy"
              unoptimized={shouldUnoptimizeEventImage(placeholderUrl)}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-base">
              {event.title}
            </h2>
            <span className="shrink-0 rounded-md bg-background/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted ring-1 ring-white/10">
              {getTypeLabel(event.type)}
            </span>
          </div>
          <p className="text-xs text-muted">{event.organizer.orgName}</p>
          <p className="text-xs text-muted">{formatDate(event.startAt)}</p>
          {(event.venue || event.city) && (
            <p className="line-clamp-1 text-xs text-foreground/80">
              {[event.venue, event.city].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2 pt-2">
            <span className="text-[10px] text-muted">All AXS</span>
            {minPrice !== null && (
              <span className="text-sm font-semibold text-primary">
                From {minPrice / 100} {currency}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/e/${event.slug}`}
      className={[
        "group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border/80 bg-surface/55 ring-1 ring-white/[0.06] transition-all duration-300 hover:border-primary/25",
        featuredRail
          ? "shadow-sm hover:shadow-md hover:border-primary/20"
          : "shadow-sm hover:shadow-lg",
        compact || featuredRail ? "h-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`View event: ${event.title}`}
    >
      {/* Default: 2:3 poster. featuredRail: shorter 3:4 so the home rail fits the viewport. Compact: wide banner. */}
      <div
        className={[
          "relative bg-foreground/5 overflow-hidden",
          compact
            ? "aspect-[16/10] sm:aspect-[5/3]"
            : featuredRail
              ? "aspect-[3/4]"
              : "aspect-[2/3]",
        ].join(" ")}
      >
        {event.bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={event.title}
            fill
            className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            sizes={
              compact
                ? "(max-width: 640px) 85vw, 320px"
                : featuredRail
                  ? "(max-width: 640px) 90vw, 400px"
                  : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 28vw"
            }
            unoptimized={shouldUnoptimizeEventImage(bannerUrl)}
          />
        ) : (
          <Image
            src={placeholderUrl}
            alt={event.title}
            fill
            className="object-cover object-top"
            sizes={
              compact
                ? "(max-width: 640px) 85vw, 320px"
                : featuredRail
                  ? "(max-width: 640px) 90vw, 400px"
                  : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 28vw"
            }
            loading="lazy"
            unoptimized={shouldUnoptimizeEventImage(placeholderUrl)}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-foreground/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div
        className={[
          "flex flex-col flex-1",
          compact
            ? "gap-2 p-3 sm:p-3.5"
            : featuredRail
              ? "gap-1.5 p-3 sm:gap-2 sm:p-3.5"
              : "gap-3 p-5",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            className={[
              "font-display font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2",
              compact
                ? "text-[15px] sm:text-base"
                : featuredRail
                  ? "text-[15px] sm:text-base"
                  : "text-lg",
            ].join(" ")}
          >
            {event.title}
          </h2>
          <span
            className={[
              "shrink-0 uppercase tracking-widest text-muted font-medium rounded-md bg-background border border-border",
              compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1",
            ].join(" ")}
          >
            {getTypeLabel(event.type)}
          </span>
        </div>
        <p
          className={
            compact ? "text-xs text-muted" : featuredRail ? "text-xs text-muted" : "text-sm text-muted"
          }
        >
          {formatDate(event.startAt)}
        </p>
        {event.venue && (
          <p
            className={[
              "text-foreground/80 line-clamp-1",
              compact ? "text-xs" : featuredRail ? "text-xs" : "text-sm",
            ].join(" ")}
          >
            {event.venue}
            {event.city ? ` · ${event.city}` : ""}
          </p>
        )}
        {event.description && !compact && (
          <p
            className={[
              "text-muted flex-1",
              featuredRail ? "line-clamp-1 text-xs leading-snug" : "text-sm line-clamp-2",
            ].join(" ")}
          >
            {event.description}
          </p>
        )}
        <div
          className={[
            "flex items-center justify-between border-t border-border/70",
            compact ? "mt-auto pt-1.5" : featuredRail ? "mt-auto pt-1.5" : "pt-2",
          ].join(" ")}
        >
          <span
            className={
              compact ? "text-[10px] text-muted" : featuredRail ? "text-[10px] text-muted" : "text-xs text-muted"
            }
          >
            All AXS
          </span>
          {minPrice !== null && (
            <span
              className={[
                "font-semibold text-primary",
                compact || featuredRail ? "text-xs" : "text-sm",
              ].join(" ")}
            >
              From {minPrice / 100} {currency}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
