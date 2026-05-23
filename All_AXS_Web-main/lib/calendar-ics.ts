function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso?: string;
  url?: string;
  uid?: string;
};

export function buildIcsCalendarFile(input: CalendarEventInput): string {
  const start = toIcsUtc(input.startIso);
  if (!start) {
    throw new Error("Invalid event start time");
  }
  const end = input.endIso ? toIcsUtc(input.endIso) : start;
  const uid = input.uid ?? `${Date.now()}@allaxs.com`;
  const now = toIcsUtc(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//All AXS//Fan Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }
  if (input.url?.trim()) {
    lines.push(`URL:${escapeIcsText(input.url.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(input: CalendarEventInput): string | null {
  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = input.endIso ? new Date(input.endIso) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (input.description?.trim()) params.set("details", input.description.trim());
  if (input.location?.trim()) params.set("location", input.location.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
