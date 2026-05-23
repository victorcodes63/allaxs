"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getSavedSlugs } from "@/lib/fan-saved-events";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import type { PublicEvent } from "@/lib/types/public-event";

export default function FanSavedEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const userKey = user?.id || user?.email || "";
  const [events, setEvents] = useState<PublicEvent[] | null>(null);
  const [missingSlugs, setMissingSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userKey) {
      setEvents([]);
      setMissingSlugs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const slugs = getSavedSlugs(userKey);
    if (slugs.length === 0) {
      setEvents([]);
      setMissingSlugs([]);
      setLoading(false);
      return;
    }

    const results = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await fetch(`/api/public/events/by-slug/${encodeURIComponent(slug)}`, {
            credentials: "same-origin",
          });
          if (!res.ok) return { slug, event: null as PublicEvent | null };
          const event = (await res.json()) as PublicEvent;
          return { slug, event };
        } catch {
          return { slug, event: null as PublicEvent | null };
        }
      }),
    );

    const loaded: PublicEvent[] = [];
    const missing: string[] = [];
    for (const { slug, event } of results) {
      if (event?.slug) loaded.push(event);
      else missing.push(slug);
    }

    loaded.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    setEvents(loaded);
    setMissingSlugs(missing);
    setLoading(false);
  }, [userKey]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  useEffect(() => {
    if (!userKey || typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("allaxs-fan-saved-events-")) {
        void load();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userKey, load]);

  if (authLoading || loading) {
    return (
      <div className="space-y-4 pb-12">
        <header className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Discover</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Saved events
          </h1>
        </header>
        <p className="text-sm text-muted">Loading saved events…</p>
      </div>
    );
  }

  const slugs = getSavedSlugs(userKey);

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Discover</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Saved events
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Events you saved while browsing. Tap the heart on any listing to add or remove it from
          this list.
        </p>
      </header>

      {slugs.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
          <p className="text-lg text-muted">No saved events yet.</p>
          <p className="text-sm text-muted">
            Browse listings and tap the heart icon to keep events you are interested in.
          </p>
          <Link
            href="/dashboard/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <>
          {missingSlugs.length > 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-border/80 bg-surface/60 px-4 py-3 text-sm text-muted">
              {missingSlugs.length === 1
                ? "One saved event is no longer published and was hidden."
                : `${missingSlugs.length} saved events are no longer published and were hidden.`}
            </div>
          ) : null}
          {events && events.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <PublicEventCard
                  key={event.id}
                  event={event}
                  eventHref={`/dashboard/events/${event.slug}`}
                  saveSlug={event.slug}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-12 text-center">
              <p className="text-sm text-muted">Saved events could not be loaded. Try again later.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
