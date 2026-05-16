import { Suspense } from "react";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";
import { TicketScanPanel } from "@/components/tickets/TicketScanPanel";

export default function AdminTicketScanPage() {
  return (
    <div className={ADMIN_PAGE_SHELL}>
      <Suspense fallback={<p className="py-8 text-sm text-muted">Loading scanner…</p>}>
        <TicketScanPanel
          scanEndpoint="/api/admin/tickets/scan"
          title="Scan tickets"
          subtitle="Scan ticket QR links (allaxs.com/v/…) or paste legacy JSON. Admins can verify any paid ticket."
        />
      </Suspense>
    </div>
  );
}
