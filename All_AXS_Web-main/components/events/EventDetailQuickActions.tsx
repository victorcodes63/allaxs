"use client";

import { useState } from "react";
import {
  buildIcsCalendarFile,
  downloadIcsFile,
  googleCalendarUrl,
} from "@/lib/calendar-ics";

type EventDetailQuickActionsProps = {
  title: string;
  startIso: string;
  endIso: string;
  location?: string | null;
  description?: string | null;
  shareUrl: string;
  mapsUrl?: string | null;
};

export function EventDetailQuickActions({
  title,
  startIso,
  endIso,
  location,
  description,
  shareUrl,
  mapsUrl,
}: EventDetailQuickActionsProps) {
  const [copied, setCopied] = useState(false);

  const calendarInput = {
    title,
    startIso,
    endIso,
    location: location ?? undefined,
    description: description ?? undefined,
    url: shareUrl,
    uid: `${startIso}-${title}@allaxs.com`,
  };

  const googleUrl = googleCalendarUrl(calendarInput);

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const onDownloadIcs = () => {
    try {
      const content = buildIcsCalendarFile(calendarInput);
      const safeName = title.replace(/[^\w\s-]/g, "").trim().slice(0, 48) || "event";
      downloadIcsFile(`${safeName}.ics`, content);
    } catch {
      /* invalid dates */
    }
  };

  const actionClass =
    "inline-flex min-h-[var(--btn-min-h)] flex-1 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background/60 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.06] sm:flex-none sm:min-w-[9.5rem] sm:text-[11px]";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {googleUrl ? (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
          Add to calendar
        </a>
      ) : null}
      <button type="button" onClick={onDownloadIcs} className={actionClass}>
        Download .ics
      </button>
      <button type="button" onClick={() => void onCopyLink()} className={actionClass}>
        {copied ? "Link copied" : "Copy event link"}
      </button>
      {mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
          Open in maps
        </a>
      ) : null}
    </div>
  );
}
