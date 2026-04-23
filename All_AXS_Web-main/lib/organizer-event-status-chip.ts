import { EventStatus } from "@/lib/validation/event";

/** Status pill styling for organiser surfaces (dark theme). */
export function organizerEventStatusChipClass(status: string): string {
  switch (status) {
    case EventStatus.DRAFT:
      return "border border-white/10 bg-white/[0.06] text-foreground/90";
    case EventStatus.PENDING_REVIEW:
      return "border border-amber-400/25 bg-amber-500/15 text-amber-100";
    case EventStatus.APPROVED:
      return "border border-sky-400/25 bg-sky-500/15 text-sky-100";
    case EventStatus.PUBLISHED:
      return "border border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case EventStatus.REJECTED:
      return "border border-red-400/30 bg-red-500/12 text-red-100";
    case EventStatus.ARCHIVED:
      return "border border-white/10 bg-white/[0.04] text-muted";
    default:
      return "border border-white/10 bg-white/[0.06] text-foreground/80";
  }
}
