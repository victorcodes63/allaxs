"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  findTicketsByOrderId,
  loadOrderSnapshot,
  type StoredOrder,
  type StoredTicket,
} from "@/lib/checkout-storage";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";

function firstName(name: string): string {
  const t = name.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? "there";
}

function ticketAbsoluteUrl(origin: string, ticketId: string): string {
  return `${origin}/tickets/${ticketId}`;
}

function buildDemoEmailLink(order: StoredOrder, passUrls: string[]): string {
  const subject = encodeURIComponent(`Your tickets — ${order.eventTitle} (All AXS demo)`);
  const body = encodeURIComponent(
    `Hi ${order.buyerName},\n\nYour demo order is confirmed. Open each link on this device to show a QR pass at the door:\n\n${passUrls.join("\n")}\n\nOrder id: ${order.orderId}\n`
  );
  return `mailto:${order.buyerEmail}?subject=${subject}&body=${body}`;
}

function buildWhatsAppDemoLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<StoredOrder | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [resendInFlight, setResendInFlight] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sent" | "failed">("idle");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const local = loadOrderSnapshot(orderId);
    if (local) {
      setOrder(local);
      return () => {
        cancelled = true;
      };
    }

    if (!isApiCheckoutEnabled()) {
      setOrder(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const res = await fetch(`/api/checkout/orders/${orderId}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (!cancelled) setOrder(null);
          return;
        }
        const data = (await res.json()) as {
          order: {
            id: string;
            status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "DRAFT";
            eventId: string;
            totalCents: number;
            subtotalCents?: number;
            discountCents?: number;
            feesCents?: number;
            currency: string;
            eventTitle: string;
            eventSlug: string;
            buyerName: string;
            buyerEmail: string;
            coupon?: { code: string; discountCents: number } | null;
            lineItems: {
              ticketTypeId: string;
              name: string;
              quantity: number;
              unitPriceCents: number;
              currency: string;
            }[];
          };
        };
        if (cancelled) return;
        const o = data.order;
        setOrder({
          orderId: o.id,
          createdAt: new Date().toISOString(),
          eventId: o.eventId,
          eventSlug: o.eventSlug,
          eventTitle: o.eventTitle,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          lineItems: o.lineItems.map((li) => ({
            ticketTypeId: li.ticketTypeId,
            name: li.name,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            currency: li.currency,
          })),
          totalCents: o.totalCents,
          currency: o.currency,
          ...(typeof o.feesCents === "number" && o.feesCents > 0 ? { feesCents: o.feesCents } : {}),
          ...(typeof o.subtotalCents === "number" ? { subtotalCents: o.subtotalCents } : {}),
          ...(typeof o.discountCents === "number" && o.discountCents > 0
            ? { discountCents: o.discountCents }
            : {}),
          ...(o.coupon ? { coupon: o.coupon } : {}),
        });
      } catch {
        if (!cancelled) setOrder(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const passes: StoredTicket[] = useMemo(
    () => (order != null ? findTicketsByOrderId(order.orderId) : []),
    [order]
  );

  const passUrls = useMemo(() => {
    if (!origin || passes.length === 0) return [];
    return passes.map((p) => ticketAbsoluteUrl(origin, p.id));
  }, [origin, passes]);

  const whatsappHref = useMemo(() => {
    if (!order || passUrls.length === 0) return null;
    if (
      order.guestCheckout !== true ||
      order.ticketDelivery !== "email_and_whatsapp" ||
      !order.buyerPhone
    ) {
      return null;
    }
    return buildWhatsAppDemoLink(
      order.buyerPhone,
      `All AXS demo — your passes for ${order.eventTitle}:\n${passUrls.join("\n")}`
    );
  }, [order, passUrls]);

  const copyPassLinks = useCallback(async () => {
    if (passUrls.length === 0) return;
    try {
      await navigator.clipboard.writeText(passUrls.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [passUrls]);

  const resendTicketEmail = useCallback(async (): Promise<boolean> => {
    setResendInFlight(true);
    try {
      const res = await fetch(`/api/checkout/orders/${orderId}/resend-tickets`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setResendState("failed");
        return false;
      }
      setResendState("sent");
      return true;
    } catch {
      setResendState("failed");
      return false;
    } finally {
      setResendInFlight(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    if (!isApiCheckoutEnabled()) return;
    if (order.guestCheckout === true) return;
    if (typeof window === "undefined") return;

    const sentKey = `ticket-email-sent:${order.orderId}`;
    if (window.localStorage.getItem(sentKey) === "true") {
      setResendState("sent");
      return;
    }

    void (async () => {
      const sent = await resendTicketEmail();
      if (sent) {
        window.localStorage.setItem(sentKey, "true");
      }
    })();
  }, [order, resendTicketEmail]);

  if (order === undefined) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted">
        Loading confirmation…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-6">
        <h1 className="font-display text-2xl text-foreground">Order not found</h1>
        <p className="text-muted">
          This confirmation link may have expired in your browser, or the order id is invalid.
        </p>
        <ArrowCtaLink href="/events" variant="primary">
          Browse events
        </ArrowCtaLink>
      </div>
    );
  }

  const apiCheckout = isApiCheckoutEnabled();
  const guest = order.guestCheckout === true;
  const delivery = order.ticketDelivery;

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-16">
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-8 md:p-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-wash text-3xl">
          ✓
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">You&apos;re in</p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">
          Thanks, {firstName(order.buyerName)}!
        </h1>
        <p className="text-muted leading-relaxed">
          Order <span className="font-mono text-foreground text-sm">{order.orderId.slice(0, 8)}…</span>{" "}
          {apiCheckout ? "has been confirmed." : "is confirmed (demo—no real card / payment charge)."}
          {guest ? (
            <>
              {" "}
              {delivery === "email_and_whatsapp" && order.buyerPhone ? (
                <>
                  In production we&apos;d email your receipt and ticket links to{" "}
                  <span className="text-foreground font-medium">{order.buyerEmail}</span> and send a WhatsApp summary to{" "}
                  <span className="text-foreground font-medium">{order.buyerPhone}</span>. For this demo, QR passes are
                  stored on <strong>this device</strong>—open{" "}
                  <Link href="/tickets" className="text-primary font-semibold hover:underline">
                    My tickets
                  </Link>{" "}
                  in this browser to scan them.
                </>
              ) : (
                <>
                  In production we&apos;d email your receipt and ticket links to{" "}
                  <span className="text-foreground font-medium">{order.buyerEmail}</span>. For this demo, QR passes are
                  stored on <strong>this device</strong>—open{" "}
                  <Link href="/tickets" className="text-primary font-semibold hover:underline">
                    My tickets
                  </Link>{" "}
                  in this browser to scan them.
                </>
              )}{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                Create an account
              </Link>{" "}
              with the same email later to sync passes when that&apos;s enabled.
            </>
          ) : apiCheckout ? (
            <>
              {" "}
              Your payment has been verified and tickets were issued. Open{" "}
              <Link href="/tickets" className="text-primary font-semibold hover:underline">
                My tickets
              </Link>{" "}
              for QR codes, or request a resend below.
            </>
          ) : (
            <>
              {" "}
              Your passes are saved in this browser—open{" "}
              <Link href="/tickets" className="text-primary font-semibold hover:underline">
                My tickets
              </Link>{" "}
              to open each pass and scan the QR code.
            </>
          )}
        </p>
      </div>

      {passes.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Your passes (demo)</h2>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Each link opens a QR code for entry. In this demo, passes live in this browser—keep the same session or
              use the buttons below to send yourself the links.
            </p>
          </div>
          <ul className="space-y-2">
            {passes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/tickets/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background/80 px-4 py-3 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-wash/60 transition-colors"
                >
                  <span>
                    <span className="text-foreground">{p.tierName}</span>
                    <span className="block text-xs font-normal text-muted font-mono truncate max-w-[240px] sm:max-w-xs">
                      {p.id}
                    </span>
                  </span>
                  <span className="text-primary shrink-0">Open QR →</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            {passUrls.length > 0 && (
              <a
                href={buildDemoEmailLink(order, passUrls)}
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/5"
              >
                Open email draft with links
              </a>
            )}
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-[#25D366] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95"
              >
                Send links in WhatsApp
              </a>
            ) : null}
            {passUrls.length > 0 && (
              <button
                type="button"
                onClick={() => void copyPassLinks()}
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45"
              >
                {copied ? "Copied!" : "Copy pass links"}
              </button>
            )}
          </div>
        </div>
      )}

      {passes.length === 0 && (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-5 py-4 text-sm text-muted">
          <p className="font-medium text-foreground">No passes found in this browser</p>
          <p className="mt-1 leading-relaxed">
            QR tickets are stored in session storage for the demo. Open this confirmation on the same device where you
            paid, or go to <Link href="/tickets" className="text-primary font-semibold hover:underline">My tickets</Link>{" "}
            there.
          </p>
        </div>
      )}

      <div className="rounded-[var(--radius-panel)] border border-border bg-background/80 p-6 md:p-8 space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">{order.eventTitle}</h2>
        <ul className="divide-y divide-border text-sm">
          {order.lineItems.map((li) => (
            <li key={`${li.ticketTypeId}-${li.quantity}`} className="flex justify-between gap-4 py-3">
              <span>
                {li.name} × {li.quantity}
              </span>
              <span className="tabular-nums font-medium">
                {(li.unitPriceCents * li.quantity) / 100} {li.currency}
              </span>
            </li>
          ))}
          {(order.discountCents ?? 0) > 0 ? (
            <li className="flex justify-between gap-4 py-3 text-foreground">
              <span>
                Discount
                {order.coupon ? (
                  <span className="ml-2 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {order.coupon.code}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums font-medium text-primary">
                −{(order.discountCents ?? 0) / 100} {order.currency}
              </span>
            </li>
          ) : null}
          <li className="flex justify-between gap-4 py-4 font-semibold text-foreground">
            <span>Total paid</span>
            <span className="tabular-nums">
              {order.totalCents / 100} {order.currency}
            </span>
          </li>
          {apiCheckout && order.feesCents != null && order.feesCents > 0 ? (
            <li className="flex justify-between gap-4 pb-2 text-xs leading-relaxed text-muted">
              <span>Platform fee (from organiser proceeds — not added on top)</span>
              <span className="shrink-0 tabular-nums">
                {order.feesCents / 100} {order.currency}
              </span>
            </li>
          ) : null}
        </ul>
        <p className="text-xs text-muted">
          {guest ? (
            <>
              Ticket details (demo): <span className="text-foreground">{order.buyerEmail}</span>
              {order.buyerPhone && delivery === "email_and_whatsapp" ? (
                <>
                  {" "}
                  · WhatsApp: <span className="text-foreground">{order.buyerPhone}</span>
                </>
              ) : null}
            </>
          ) : (
            <>
              Confirmation sent to <span className="text-foreground">{order.buyerEmail}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
        {apiCheckout ? (
          <button
            type="button"
            onClick={() => {
              void resendTicketEmail();
            }}
            disabled={resendInFlight}
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45"
          >
            {resendInFlight
              ? "Sending ticket email…"
              : resendState === "sent"
                ? "Ticket email sent"
                : resendState === "failed"
                  ? "Retry ticket email"
                  : "Resend ticket email"}
          </button>
        ) : null}
        {passes[0] ? (
          <ArrowCtaLink href={`/tickets/${passes[0].id}`} variant="primary" className="justify-center">
            Open first QR pass
          </ArrowCtaLink>
        ) : null}
        <ArrowCtaLink href="/tickets" variant={passes[0] ? "outline" : "primary"} className="justify-center">
          View all tickets
        </ArrowCtaLink>
        <ArrowCtaLink
          href={`/e/${order.eventSlug}`}
          variant="outline"
          className="justify-center"
        >
          Back to event
        </ArrowCtaLink>
      </div>
    </div>
  );
}
