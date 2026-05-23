"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAllTickets, type StoredTicket } from "@/lib/checkout-storage";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { mergeTicketsById, normalizeApiTicketsPayload } from "@/lib/tickets-api";
import { splitTicketsByTime } from "@/lib/tickets-grouping";

type TicketTab = "upcoming" | "past" | "all";

function formatTicketWhen(startIso?: string, endIso?: string): string | null {
  if (!startIso) return null;
  try {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;
    const startLabel = start.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!endIso) return startLabel;
    const end = new Date(endIso);
    if (Number.isNaN(end.getTime())) return startLabel;
    if (start.toDateString() === end.toDateString()) {
      return `${startLabel} - ${end.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return `${startLabel} - ${end.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return null;
  }
}

function compactTicketRef(id: string): string {
  return id.startsWith("tk_") ? id.slice(3, 11).toUpperCase() : id.slice(0, 8).toUpperCase();
}

type ResendState = "idle" | "sending" | "sent" | "failed";

type OrderGroup = {
  orderId: string;
  eventTitle: string;
  ticketCount: number;
};

function groupTicketsByOrder(tickets: StoredTicket[]): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  for (const ticket of tickets) {
    const orderId = ticket.orderId?.trim();
    if (!orderId) continue;
    const existing = groups.get(orderId);
    if (existing) {
      existing.ticketCount += 1;
      continue;
    }
    groups.set(orderId, {
      orderId,
      eventTitle: ticket.eventTitle?.trim() || "Your event",
      ticketCount: 1,
    });
  }
  return [...groups.values()];
}

export function TicketsList() {
  const [mounted, setMounted] = useState(false);
  const [apiTickets, setApiTickets] = useState<StoredTicket[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resendByOrder, setResendByOrder] = useState<Record<string, ResendState>>({});
  const [activeTab, setActiveTab] = useState<TicketTab>("upcoming");

  const apiCheckout = isApiCheckoutEnabled();

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted || !apiCheckout) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tickets/me", { credentials: "same-origin" });
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 401) {
            setApiError("Sign in to load tickets linked to your account.");
          } else {
            setApiError("Could not load tickets from the server.");
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setApiTickets(normalizeApiTicketsPayload(data));
      } catch {
        if (!cancelled) setApiError("Could not load tickets.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, apiCheckout]);

  const sessionTickets = mounted ? loadAllTickets() : [];
  const tickets: StoredTicket[] = !apiCheckout
    ? sessionTickets
    : apiError
      ? sessionTickets
      : mergeTicketsById(apiTickets ?? [], sessionTickets);

  const orderGroups = useMemo(() => groupTicketsByOrder(tickets), [tickets]);
  const { upcoming, past, unknown } = useMemo(() => splitTicketsByTime(tickets), [tickets]);
  const visibleTickets = useMemo(() => {
    if (activeTab === "upcoming") return [...upcoming, ...unknown];
    if (activeTab === "past") return past;
    return tickets;
  }, [activeTab, upcoming, past, unknown, tickets]);

  const resendTicketEmail = async (orderId: string) => {
    setResendByOrder((prev) => ({ ...prev, [orderId]: "sending" }));
    try {
      const res = await fetch(`/api/checkout/orders/${orderId}/resend-tickets`, {
        method: "POST",
        credentials: "same-origin",
      });
      setResendByOrder((prev) => ({
        ...prev,
        [orderId]: res.ok ? "sent" : "failed",
      }));
    } catch {
      setResendByOrder((prev) => ({ ...prev, [orderId]: "failed" }));
    }
  };

  const awaitingServerList =
    apiCheckout && apiTickets === null && !apiError && tickets.length === 0;

  if (!mounted) {
    return <p className="text-muted py-12 text-center">Loading tickets…</p>;
  }

  if (awaitingServerList) {
    return <p className="text-muted py-12 text-center">Loading tickets…</p>;
  }

  if (apiError && tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
        <p className="text-lg text-muted">{apiError}</p>
        <ArrowCtaLink href="/login" variant="primary">
          Sign in
        </ArrowCtaLink>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
        <p className="text-lg text-muted">No tickets yet—complete checkout on a published event.</p>
        <ArrowCtaLink href="/dashboard/events" variant="primary">
          Find an event
        </ArrowCtaLink>
      </div>
    );
  }

  const sessionFallbackBanner =
    apiCheckout && apiError && tickets.length > 0 ? (
      <div className="rounded-[var(--radius-panel)] border border-border bg-primary/5 px-5 py-4 text-sm text-muted">
        <p className="font-medium text-foreground">Account passes unavailable</p>
        <p className="mt-1 leading-relaxed">{apiError}</p>
        <p className="mt-2 leading-relaxed">
          Sign in to sync tickets from your account, or check your email for the PDF attachment with entry QR codes.
        </p>
      </div>
    ) : null;

  const resendEmailBanner =
    apiCheckout && !apiError && orderGroups.length > 0 ? (
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-5 py-4 text-sm text-muted space-y-3">
        <div>
          <p className="font-medium text-foreground">Email tickets</p>
          <p className="mt-1 leading-relaxed">
            Ticket QR codes are in the PDF attachment we email after purchase—not inline in the message body. Open any
            pass below to view a QR code or download a PDF.
          </p>
        </div>
        <ul className="space-y-2">
          {orderGroups.map((group) => {
            const state = resendByOrder[group.orderId] ?? "idle";
            const label =
              state === "sending"
                ? "Sending…"
                : state === "sent"
                  ? "Email sent"
                  : state === "failed"
                    ? "Retry email"
                    : "Resend ticket email";
            return (
              <li
                key={group.orderId}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-[var(--radius-card)] border border-border/80 bg-background/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground line-clamp-1">{group.eventTitle}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {group.ticketCount} pass{group.ticketCount === 1 ? "" : "es"} · Order{" "}
                    <span className="font-mono">{group.orderId.slice(0, 8)}…</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void resendTicketEmail(group.orderId)}
                  disabled={state === "sending"}
                  className="inline-flex min-h-[var(--btn-min-h)] shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 disabled:opacity-70"
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {sessionFallbackBanner}
      {resendEmailBanner}

      <div className="flex flex-wrap gap-2">
        {([
          ["upcoming", `Upcoming (${upcoming.length + unknown.length})`],
          ["past", `Past (${past.length})`],
          ["all", `All (${tickets.length})`],
        ] as Array<[TicketTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors",
              activeTab === tab
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/80 bg-background/40 text-muted hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleTickets.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-12 text-center">
          <p className="text-muted">
            {activeTab === "upcoming"
              ? "No upcoming passes. Check Past or browse events for your next show."
              : activeTab === "past"
                ? "No past passes yet."
                : "No tickets found."}
          </p>
        </div>
      ) : (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
      {visibleTickets.map((t: StoredTicket) => {
        const whenLabel = formatTicketWhen(t.eventStartAt, t.eventEndAt);
        const locationLabel = [t.eventVenue, t.eventCity].filter(Boolean).join(" · ");
        return (
          <li key={t.id}>
            <Link
              href={`/tickets/${t.id}`}
              className="block rounded-[var(--radius-card)] border border-border bg-surface p-6 hover:border-primary/35 hover:shadow-md transition-all group"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Event pass</p>
              <p className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {t.eventTitle?.trim() ? t.eventTitle : "Your event"}
              </p>
              <p className="text-sm text-muted mt-1.5">{t.tierName}</p>
              {whenLabel ? <p className="mt-3 text-sm text-foreground/90">{whenLabel}</p> : null}
              {locationLabel ? <p className="mt-1 text-sm text-muted line-clamp-1">{locationLabel}</p> : null}
              <p className="mt-4 text-[11px] text-muted">
                Ref <span className="font-mono tracking-[0.06em]">{compactTicketRef(t.id)}</span>
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
                  {apiCheckout ? "View pass" : "View QR"}
                </span>
                <span
                  aria-hidden
                  className="text-base leading-none text-primary transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>
            </Link>
          </li>
        );
      })}
      </ul>
      )}
    </div>
  );
}
