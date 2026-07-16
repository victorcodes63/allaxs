import Link from "next/link";
import type { PublicEvent } from "@/lib/types/public-event";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { TierWaitlistJoin } from "@/components/events/TierWaitlistJoin";
import {
  formatPriceDisplay,
  isTierOnDisplay,
  isTierSoldOut,
} from "@/lib/events/event-detail-format";
import { resolveCurrencyFromTiers } from "@/lib/currency";
import { platformSupportMailto } from "@/lib/site-contact";

type EventDetailTicketsAsideProps = {
  event: PublicEvent;
  checkoutHref: string;
  minPrice: number | null;
  refundPolicyHref?: string;
  supportHref?: string;
};

export function EventDetailTicketsAside({
  event,
  checkoutHref,
  minPrice,
  refundPolicyHref = "/refund-policy",
  supportHref = platformSupportMailto({ subject: "Event support" }),
}: EventDetailTicketsAsideProps) {
  const currency = resolveCurrencyFromTiers(event.ticketTypes);
  const displayTiers = event.ticketTypes?.filter(isTierOnDisplay) ?? [];
  const hasAvailableTier = displayTiers.some((tier) => !isTierSoldOut(tier));

  return (
    <aside
      aria-label="Tickets and checkout"
      className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1"
    >
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <div className="border-b border-border/70 bg-wash/40 p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Tickets</h2>
          {minPrice !== null ? (
            <p className="mt-1 text-sm text-muted">
              From{" "}
              <span className="font-semibold text-primary">
                {formatPriceDisplay(minPrice, currency)}
              </span>
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Choose your tier on the next screen. Your pass lands in your wallet after payment.
          </p>
        </div>

        <ul className="max-h-[min(50vh,360px)] divide-y divide-border/70 overflow-y-auto overscroll-contain lg:max-h-[320px]">
          {displayTiers.length === 0 ? (
            <li className="p-5 text-sm leading-relaxed text-muted">
              No passes on sale right now. Check back soon or browse other events.
            </li>
          ) : (
            displayTiers.map((tier) => {
              const soldOut = isTierSoldOut(tier);
              const left = soldOut ? 0 : (tier.quantityTotal ?? 0) - (tier.quantitySold ?? 0);
              const total = tier.quantityTotal ?? 0;
              const almostGone =
                left > 0 && total > 0 && (left <= 20 || left / total <= 0.12);
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
                <li key={tier.id} className="p-5 transition-colors hover:bg-background/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{tier.name}</p>
                      {tier.description ? (
                        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">
                          {tier.description}
                        </p>
                      ) : null}
                      {limits ? <p className="mt-2 text-xs text-muted">{limits}</p> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {formatPriceDisplay(tier.priceCents, tier.currency)}
                    </span>
                    <span
                      className={
                        almostGone
                          ? "text-xs font-medium tabular-nums text-primary/90"
                          : "text-xs tabular-nums text-muted"
                      }
                    >
                      {soldOut
                        ? "Sold out"
                        : left > 0
                          ? almostGone
                            ? `${left} left · selling fast`
                            : `${left} left`
                          : "Sold out"}
                    </span>
                  </div>
                  {soldOut && tier.id ? (
                    <TierWaitlistJoin
                      eventId={event.id}
                      tierId={tier.id}
                      tierName={tier.name}
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t border-border/70 bg-background/50 p-5 sm:p-6">
          {hasAvailableTier ? (
            <ArrowCtaLink href={checkoutHref} variant="primary" fullWidth>
              Buy tickets
            </ArrowCtaLink>
          ) : (
            <p className="text-center text-sm leading-relaxed text-muted">
              All tiers are sold out. Join a waitlist above if a spot opens up.
            </p>
          )}
          <p className="mt-3 text-center text-xs leading-relaxed text-muted">
            Refunds follow our{" "}
            <Link href={refundPolicyHref} className="text-primary underline decoration-primary/40">
              refund policy
            </Link>
            . Need help?{" "}
            {supportHref.startsWith("mailto:") ? (
              <a href={supportHref} className="text-primary underline decoration-primary/40">
                Contact support
              </a>
            ) : (
              <Link href={supportHref} className="text-primary underline decoration-primary/40">
                Contact support
              </Link>
            )}
            .
          </p>
        </div>
      </div>
    </aside>
  );
}
