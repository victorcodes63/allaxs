import { Suspense } from "react";
import { OrganizerSalesContent } from "@/components/organizer/OrganizerSalesView";

export default function OrganizerSalesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-foreground">Loading sales…</p>
          <p className="text-xs text-muted">Orders and performance</p>
        </div>
      }
    >
      <OrganizerSalesContent />
    </Suspense>
  );
}
