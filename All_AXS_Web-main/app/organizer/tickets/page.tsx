import { Suspense } from "react";
import { OrganizerTicketsContent } from "@/components/organizer/OrganizerTicketsView";

export default function OrganizerTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-foreground">Loading tickets…</p>
          <p className="text-xs text-muted">Door list and check-in</p>
        </div>
      }
    >
      <OrganizerTicketsContent />
    </Suspense>
  );
}
