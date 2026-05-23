"use client";

import {
  buildIcsCalendarFile,
  downloadIcsFile,
  googleCalendarUrl,
  type CalendarEventInput,
} from "@/lib/calendar-ics";
import { Button } from "@/components/ui/Button";

type TicketCalendarActionsProps = {
  title: string;
  startIso: string;
  endIso?: string | null;
  location?: string | null;
  description?: string | null;
  eventUrl?: string | null;
};

export function TicketCalendarActions({
  title,
  startIso,
  endIso,
  location,
  description,
  eventUrl,
}: TicketCalendarActionsProps) {
  const input: CalendarEventInput = {
    title,
    startIso,
    endIso: endIso ?? undefined,
    location: location ?? undefined,
    description: description ?? undefined,
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

  return (
    <section
      aria-labelledby="calendar-actions-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6"
    >
      <h2
        id="calendar-actions-heading"
        className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
      >
        Add to calendar
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Save this event to your calendar so you do not miss show time.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {googleUrl ? (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[var(--btn-min-h)] w-full items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-[var(--btn-pad-x)] py-[var(--btn-pad-y)] text-sm font-semibold text-foreground shadow-[var(--btn-shadow-outline)] transition-colors hover:border-primary/35 hover:bg-wash sm:w-auto sm:min-w-[10rem]"
          >
            Google Calendar
          </a>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto min-w-[10rem]"
          onClick={onDownloadIcs}
        >
          Download .ics
        </Button>
      </div>
    </section>
  );
}
