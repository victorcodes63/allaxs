/**
 * Server-side API client for SSR pages
 * Uses fetch directly to the NestJS backend.
 *
 * Demo listings (no API):
 * - NEXT_PUBLIC_USE_DEMO_EVENTS=true  → always use demo data
 * - NEXT_PUBLIC_USE_DEMO_EVENTS=false → always use the API
 * - unset                             → in development, use demo; in production, use API
 */

import { DEMO_PUBLIC_EVENTS } from "@/lib/data/demo-public-events";
import type { PublicEvent, PublicEventsResponse } from "@/lib/types/public-event";

export type { PublicEvent, PublicEventsResponse };

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

function useDemoEvents(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_DEMO_EVENTS;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.NODE_ENV === "development";
}

function filterDemoPublicEvents(options: {
  page?: number;
  size?: number;
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  city?: string;
}): PublicEventsResponse {
  let list = [...DEMO_PUBLIC_EVENTS];

  if (options.q?.trim()) {
    const q = options.q.trim().toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q) ?? false) ||
        (e.venue?.toLowerCase().includes(q) ?? false) ||
        (e.city?.toLowerCase().includes(q) ?? false)
    );
  }
  if (options.type) {
    list = list.filter((e) => e.type === options.type);
  }
  if (options.city?.trim()) {
    const c = options.city.trim().toLowerCase();
    list = list.filter((e) => e.city?.toLowerCase() === c);
  }
  if (options.dateFrom) {
    list = list.filter((e) => e.startAt >= options.dateFrom!);
  }
  if (options.dateTo) {
    list = list.filter((e) => e.startAt <= options.dateTo!);
  }

  const page = Math.max(1, options.page ?? 1);
  const size = Math.max(1, Math.min(100, options.size ?? 20));
  const total = list.length;
  const start = (page - 1) * size;
  const events = list.slice(start, start + size);
  return { events, total, page, size };
}

/**
 * Fetch public events with filters and pagination
 */
export async function fetchPublicEvents(options: {
  page?: number;
  size?: number;
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  city?: string;
}): Promise<PublicEventsResponse> {
  if (useDemoEvents()) {
    return filterDemoPublicEvents(options);
  }

  const params = new URLSearchParams();
  if (options.page) params.append("page", options.page.toString());
  if (options.size) params.append("size", options.size.toString());
  if (options.q) params.append("q", options.q);
  if (options.type) params.append("type", options.type);
  if (options.dateFrom) params.append("dateFrom", options.dateFrom);
  if (options.dateTo) params.append("dateTo", options.dateTo);
  if (options.city) params.append("city", options.city);

  const url = `${API_BASE_URL}/events/public${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch event by slug
 */
export async function fetchEventBySlug(slug: string): Promise<PublicEvent> {
  if (useDemoEvents()) {
    const found = DEMO_PUBLIC_EVENTS.find((e) => e.slug === slug);
    if (!found) {
      throw new Error("Event not found");
    }
    return found;
  }

  const url = `${API_BASE_URL}/events/by-slug/${encodeURIComponent(slug)}`;

  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Event not found");
    }
    throw new Error(`Failed to fetch event: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get event slug by ID (for redirects)
 */
export async function getEventSlugById(id: string): Promise<string> {
  if (useDemoEvents()) {
    const found = DEMO_PUBLIC_EVENTS.find((e) => e.id === id);
    if (!found) {
      throw new Error("Event not found");
    }
    return found.slug;
  }

  const url = `${API_BASE_URL}/events/${id}/slug`;

  const response = await fetch(url, {
    next: { revalidate: 3600 },
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Event not found");
    }
    throw new Error(`Failed to fetch event slug: ${response.statusText}`);
  }

  const data = await response.json();
  return data.slug;
}
