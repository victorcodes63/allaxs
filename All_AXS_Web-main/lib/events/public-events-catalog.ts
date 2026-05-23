import type { PublicEvent } from "@/lib/types/public-event";

/** True when the event has not ended yet (still live or upcoming). */
export function isActivePublicEvent(event: PublicEvent, now = new Date()): boolean {
  return new Date(event.endAt).getTime() >= now.getTime();
}

export function comparePublicEventsByStartAt(a: PublicEvent, b: PublicEvent): number {
  return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
}

/** Closest start date first; furthest last. */
export function sortPublicEventsByStartAt(events: PublicEvent[]): PublicEvent[] {
  return [...events].sort(comparePublicEventsByStartAt);
}

export function filterActivePublicEvents(
  events: PublicEvent[],
  now = new Date(),
): PublicEvent[] {
  return events.filter((event) => isActivePublicEvent(event, now));
}
