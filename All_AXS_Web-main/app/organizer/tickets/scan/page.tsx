import { Suspense } from "react";
import { TicketScanPanel } from "@/components/tickets/TicketScanPanel";

export default function OrganizerTicketScanPage() {
  return (
    <div className="w-full min-w-0 pb-[max(0.75rem,env(safe-area-inset-bottom)))]">
      <Suspense fallback={<p className="axs-content-inner py-8 text-sm text-muted">Loading scanner…</p>}>
        <TicketScanPanel
          scanEndpoint="/api/organizer/tickets/scan"
          title="Door scan"
          subtitle="Scan guest QR codes (opens allaxs.com/v/…) or paste a ticket link. Legacy JSON passes still work."
        />
      </Suspense>
    </div>
  );
}
