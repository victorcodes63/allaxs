"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAllTickets } from "@/lib/checkout-storage";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

export function TicketsList() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  if (!mounted) {
    return <p className="text-muted py-12 text-center">Loading tickets…</p>;
  }

  const tickets = loadAllTickets();

  if (tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4 max-w-lg mx-auto">
        <p className="text-lg text-muted">No tickets yet—your QR passes will land here after purchase.</p>
        <ArrowCtaLink href="/events" variant="primary">
          Find an event
        </ArrowCtaLink>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`/tickets/${t.id}`}
            className="block rounded-[var(--radius-card)] border border-border bg-surface p-6 hover:border-primary/35 hover:shadow-md transition-all group"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Pass</p>
            <p className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {t.eventTitle}
            </p>
            <p className="text-sm text-muted mt-2">{t.tierName}</p>
            <p className="text-xs text-muted mt-4 font-mono truncate">{t.id}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
