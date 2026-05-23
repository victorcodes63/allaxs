import type { PublicEvent } from "@/lib/types/public-event";

export function formatPriceDisplay(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function getTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatSchedule(startAt: string, endAt: string): {
  headlineDate: string;
  timeRange: string;
  durationHint: string | null;
} {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const headlineDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const sameDay = start.toDateString() === end.toDateString();
  const timeRange = sameDay
    ? `${timeFmt.format(start)} – ${timeFmt.format(end)}`
    : `${timeFmt.format(start)} · ${headlineDate} → ${timeFmt.format(end)} · ${new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(end)}`;
  const durationMs = end.getTime() - start.getTime();
  const durationMins = Math.round(durationMs / 60000);
  let durationHint: string | null = null;
  if (sameDay && durationMins >= 45 && durationMins <= 18 * 60) {
    if (durationMins < 120) {
      durationHint = `${durationMins} minutes`;
    } else {
      const h = Math.round(durationMins / 60);
      durationHint = `About ${h} hour${h === 1 ? "" : "s"}`;
    }
  }
  return { headlineDate, timeRange, durationHint };
}

export function formatWhereLine(event: Pick<PublicEvent, "type" | "venue" | "city" | "country">): string | null {
  const place = [event.venue, event.city, event.country].filter(Boolean).join(" · ");
  if (event.type === "VIRTUAL") {
    return place ? `Online · ${place}` : "Online";
  }
  if (event.type === "HYBRID") {
    if (!place) return "Hybrid · in person and online";
    return `${place} · streamed online`;
  }
  return place || null;
}

export function formatStartsIn(startAt: string, now = Date.now()): string | null {
  const ms = new Date(startAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `Starts in ${mins} min`;
}

export type EventTier = NonNullable<PublicEvent["ticketTypes"]>[number];

export function isTierOnDisplay(tier: EventTier) {
  if (!tier.status || tier.status === "ACTIVE" || tier.status === "SOLD_OUT") {
    return true;
  }
  return false;
}

export function isTierSoldOut(tier: EventTier) {
  if (tier.status === "SOLD_OUT") return true;
  const total = tier.quantityTotal ?? 0;
  const sold = tier.quantitySold ?? 0;
  return total > 0 && total - sold <= 0;
}

export function isTierAvailable(tier: EventTier) {
  if (tier.status && tier.status !== "ACTIVE") return false;
  return !isTierSoldOut(tier);
}

export function mapsSearchUrl(event: Pick<PublicEvent, "venue" | "city" | "country">): string | null {
  const query = [event.venue, event.city, event.country].filter(Boolean).join(", ");
  if (!query.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
