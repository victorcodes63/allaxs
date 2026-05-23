"use client";

import Link from "next/link";
import {
  buildIcsCalendarFile,
  downloadIcsFile,
  googleCalendarUrl,
  type CalendarEventInput,
} from "@/lib/calendar-ics";

type CalendarEventRowActionsProps = {
  title: string;
  startIso: string;
  endIso?: string | null;
  location?: string | null;
  ticketId: string;
  eventUrl?: string | null;
};

export function CalendarEventRowActions({
  title,
  startIso,
  endIso,
  location,
  ticketId,
  eventUrl,
}: CalendarEventRowActionsProps) {
  const input: CalendarEventInput = {
    title,
    startIso,
    endIso: endIso ?? undefined,
    location: location ?? undefined,
    url: eventUrl ?? undefined,
    uid: `${startIso}-${title}@allaxs.com`,
  };

  const googleUrl = googleCalendarUrl(input);

  const onDownloadIcs = () => {
    try {
      const content = buildIcsCalendarFile(input);
      const safeName = title.replace(/[^\w\s-]/g, "").trim().slice(0, 48) || "event";
      downloadIcsFile(`${safeName}.ics`, content);
    } catch {
      /* invalid dates */
    }
  };

  const actionClass =
    "inline-flex min-h-9 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background/60 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.06]";

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/tickets/${ticketId}`} className={actionClass}>
        View pass
      </Link>
      {googleUrl ? (
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={actionClass}
        >
          Google Calendar
        </a>
      ) : null}
      <button type="button" onClick={onDownloadIcs} className={actionClass}>
        Download .ics
      </button>
    </div>
  );
}
