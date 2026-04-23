"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { findTicketById, type StoredTicket } from "@/lib/checkout-storage";

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<StoredTicket | null | undefined>(undefined);

  useEffect(() => {
    setTicket(findTicketById(ticketId));
  }, [ticketId]);

  if (ticket === undefined) {
    return (
      <div className="py-20 text-center text-muted">Loading…</div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-6">
        <h1 className="font-display text-2xl">Ticket not found</h1>
        <Link href="/tickets" className="text-primary font-semibold hover:underline">
          ← All tickets
        </Link>
      </div>
    );
  }

  const issued = new Date(ticket.issuedAt).toLocaleString();

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-16">
      <Link href="/tickets" className="text-sm font-medium text-muted hover:text-primary transition-colors">
        ← My tickets
      </Link>
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface overflow-hidden shadow-sm">
        <div className="bg-foreground text-background px-6 py-8 text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">All AXS</p>
          <h1 className="font-display text-2xl leading-tight">{ticket.eventTitle}</h1>
          <p className="text-white/80">{ticket.tierName}</p>
        </div>
        <div className="p-8 flex flex-col items-center gap-6">
          <div
            className="w-48 h-48 rounded-[var(--radius-card)] bg-background border-2 border-dashed border-border flex items-center justify-center text-xs text-muted text-center px-4 leading-relaxed"
            aria-label="QR code placeholder"
          >
            QR preview
            <br />
            (integrate encoder)
          </div>
          <dl className="w-full text-sm space-y-2 text-muted">
            <div className="flex justify-between gap-4">
              <dt>Email</dt>
              <dd className="text-foreground text-right break-all">{ticket.attendeeEmail}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Issued</dt>
              <dd className="text-foreground">{issued}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Ticket id</dt>
              <dd className="font-mono text-xs text-foreground break-all">{ticket.id}</dd>
            </div>
          </dl>
        </div>
      </div>
      <Link
        href={`/e/${ticket.eventSlug}`}
        className="block text-center text-sm font-semibold text-primary hover:underline"
      >
        View event page
      </Link>
    </div>
  );
}
