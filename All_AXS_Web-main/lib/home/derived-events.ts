import type { PublicEvent } from "@/lib/types/public-event";

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function deriveHomeEventsLists(events: PublicEvent[]): {
  featuredEvents: PublicEvent[];
  startingSoonEvents: PublicEvent[];
} {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const featuredEvents = sorted.slice(0, 6);
  const featuredIds = new Set(featuredEvents.map((e) => e.id));
  const now = Date.now();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 21);
  const horizonMs = horizon.getTime();

  const startingSoonEvents = sorted
    .filter((e) => {
      const t = new Date(e.startAt).getTime();
      return t >= now && t <= horizonMs && !featuredIds.has(e.id);
    })
    .slice(0, 12);

  return { featuredEvents, startingSoonEvents };
}

export function buildQuickFilterLinks(now = new Date()): { label: string; href: string }[] {
  const d0 = toYmd(now);
  const d7 = new Date(now);
  d7.setDate(d7.getDate() + 7);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() + 30);
  return [
    { label: "Next 7 days", href: `/events?dateFrom=${d0}&dateTo=${toYmd(d7)}` },
    { label: "Next 30 days", href: `/events?dateFrom=${d0}&dateTo=${toYmd(d30)}` },
    { label: "In person", href: "/events?type=IN_PERSON" },
    { label: "Online", href: "/events?type=VIRTUAL" },
  ];
}

export const HOME_GENRE_LINKS: { label: string; href: string }[] = [
  { label: "Music & nightlife", href: "/events?q=music" },
  { label: "Talks & summits", href: "/events?q=summit" },
  { label: "Wellness", href: "/events?q=wellness" },
  { label: "Career & skills", href: "/events?q=career" },
  { label: "Climate & green", href: "/events?q=climate" },
];
