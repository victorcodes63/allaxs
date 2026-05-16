import type { Metadata } from "next";
import Link from "next/link";
import { TicketVerifyLanding } from "@/components/tickets/TicketVerifyLanding";
import { decodeTicketVerifyToken } from "@/lib/ticket-qr";

export const metadata: Metadata = {
  title: "Ticket verification | All AXS",
  description: "Verify an All AXS digital ticket at the door or view your pass.",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function TicketVerifyPage({ params }: PageProps) {
  const { token } = await params;
  const decoded = decodeTicketVerifyToken(token);

  if (!decoded) {
    return (
      <div className="axs-content-inner mx-auto max-w-lg pb-20 pt-10 text-center">
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-6 py-12 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">All AXS</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">Invalid or expired link</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            This QR code could not be read. Ask the guest to open their ticket from email or{" "}
            <strong className="font-medium text-foreground">My tickets</strong>, or scan the code again in good
            lighting.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/tickets"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-button)] bg-primary px-5 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)]"
            >
              My tickets
            </Link>
            <Link
              href="/events"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-5 text-sm font-semibold text-foreground"
            >
              Browse events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <TicketVerifyLanding decoded={decoded} />;
}
