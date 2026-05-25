"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Tabs } from "@/components/ui/Tabs";
import { EventDetailsTab } from "@/components/organizer/event-editor/EventDetailsTab";
import { EventMediaTab } from "@/components/organizer/event-editor/EventMediaTab";
import { EventTicketTiersTab } from "@/components/organizer/event-editor/EventTicketTiersTab";
import { EventSalesTab } from "@/components/organizer/event-editor/EventSalesTab";
import { EventCouponsTab } from "@/components/organizer/event-editor/EventCouponsTab";
import { EventScannerTab } from "@/components/organizer/event-editor/EventScannerTab";
import { EventInsightsTab } from "@/components/organizer/event-editor/EventInsightsTab";
import { EventCompsPanel } from "@/components/organizer/event-editor/EventCompsPanel";
import { OrganizerAdminEditBanner } from "@/components/organizer/event-editor/OrganizerAdminEditBanner";
import { DeleteEventButton } from "@/components/events/DeleteEventButton";
import { DuplicateEventButton } from "@/components/events/DuplicateEventButton";
import { resolveCurrencyFromTiers } from "@/lib/currency";
import { EventStatus } from "@/lib/validation/event";

interface TicketType {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  maxPerOrder?: number;
  salesStart?: string;
  salesEnd?: string;
  currency: string;
  allowInstallments?: boolean;
  [key: string]: unknown; // Allow additional properties to match child component interfaces
}

interface Event {
  id: string;
  title: string;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  startAt: string;
  endAt: string;
  description?: string;
  status: string;
  slug: string;
  bannerUrl?: string | null;
  ticketTypes?: TicketType[];
  metadata?: {
    rejectionReason?: string;
  };
  [key: string]: unknown; // Allow additional properties to match child component interfaces
}

const EDITOR_TAB_IDS = [
  "details",
  "media",
  "ticket-tiers",
  "coupons",
  "sales",
  "insights",
  "comps",
  "scanner",
] as const;
type EditorTabId = (typeof EDITOR_TAB_IDS)[number];

function isEditorTabId(value: string | null): value is EditorTabId {
  return !!value && (EDITOR_TAB_IDS as readonly string[]).includes(value);
}

function EventEditorTabsSection({
  event,
  tabs,
}: {
  event: Event;
  tabs: {
    id: string;
    label: string;
    content: ReactNode;
  }[];
}) {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const defaultTab = useMemo((): EditorTabId => {
    const raw = searchParams.get("tab");
    if (isEditorTabId(raw)) return raw;
    const canUpload =
      event.status === EventStatus.DRAFT ||
      event.status === EventStatus.PENDING_REVIEW;
    if (!event.bannerUrl && canUpload) return "media";
    return "details";
  }, [searchParams, event.bannerUrl, event.status]);

  return (
    <Tabs
      key={`${event.id}-${qs}`}
      tabs={tabs}
      defaultTab={defaultTab}
      ariaLabel="Event editor tabs"
    />
  );
}

export default function EventEditorPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/events/${eventId}`);
        setEvent(response.data);
        setError(null);
      } catch (err) {
        const axiosError = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        
        if (axiosError.response?.status === 404) {
          setError("Event not found");
          // Redirect to events list after a delay
          setTimeout(() => {
            router.push("/organizer/events");
          }, 2000);
        } else if (axiosError.response?.status === 403) {
          setError("You do not have permission to access this event");
        } else {
          const message =
            axiosError.response?.data?.message || "Failed to load event";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId, router]);

  const handleEventUpdate = (updatedEvent: Event | (Partial<Event> & { id: string })) => {
    setEvent((prevEvent) => {
      if (!prevEvent) return prevEvent;
      // If it's a full Event, use it directly; otherwise merge with previous
      if ('title' in updatedEvent && 'type' in updatedEvent && 'slug' in updatedEvent) {
        return updatedEvent as Event;
      }
      return { ...prevEvent, ...updatedEvent } as Event;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-muted">Loading event…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-primary">{error || "Event not found"}</p>
        <Link
          href="/organizer/events"
          className="text-sm text-muted hover:text-foreground"
        >
          Back to events
        </Link>
      </div>
    );
  }

  const defaultCouponCurrency = resolveCurrencyFromTiers(event.ticketTypes);

  const tabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <EventDetailsTab event={event} onEventUpdate={handleEventUpdate} />
      ),
    },
    {
      id: "media",
      label: "Media",
      content: (
        <EventMediaTab event={event} onEventUpdate={handleEventUpdate} />
      ),
    },
    {
      id: "ticket-tiers",
      label: "Ticket Tiers",
      content: (
        <EventTicketTiersTab
          event={event}
          onEventUpdate={handleEventUpdate}
        />
      ),
    },
    {
      id: "coupons",
      label: "Coupons",
      content: (
        <EventCouponsTab
          eventId={event.id}
          defaultCurrency={defaultCouponCurrency}
        />
      ),
    },
    {
      id: "sales",
      label: "Sales",
      content: <EventSalesTab eventId={event.id} eventTitle={event.title} />,
    },
    {
      id: "insights",
      label: "Insights",
      content: <EventInsightsTab eventId={event.id} eventTitle={event.title} />,
    },
    {
      id: "comps",
      label: "Comps",
      content: (
        <EventCompsPanel
          eventId={event.id}
          eventTitle={event.title}
          ticketTypes={(event.ticketTypes ?? []).map((tt) => ({
            id: tt.id,
            name: tt.name,
          }))}
        />
      ),
    },
    {
      id: "scanner",
      label: "Scanner Links",
      content: (
        <EventScannerTab eventId={event.id} eventEndAt={event.endAt} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Editing
          </p>
          <p className="text-lg font-semibold text-foreground">{event.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DuplicateEventButton eventId={event.id} eventTitle={event.title} />
          <Link
            href="/organizer/events"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to events
          </Link>
        </div>
      </div>

      <OrganizerAdminEditBanner eventId={event.id} />

      {event.status === EventStatus.REJECTED &&
      event.metadata?.rejectionReason ? (
        <div
          className="rounded-[var(--radius-panel)] border border-amber-400/35 bg-amber-500/10 p-4 sm:p-5"
          role="status"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100/90">
            Changes requested
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            {event.metadata.rejectionReason}
          </p>
          <p className="mt-3 text-xs text-muted">
            Update the event below, then resubmit for review from the Details
            tab.
          </p>
        </div>
      ) : null}

      <Suspense
        fallback={
          <div className="min-h-[12rem] rounded-[var(--radius-panel)] border border-border bg-surface/40" />
        }
      >
        <EventEditorTabsSection event={event} tabs={tabs} />
      </Suspense>

      <section className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/5 p-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Danger zone
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Delete draft, in-review, or rejected events that you no longer need.
          Events with paid orders cannot be removed from the organizer workspace.
        </p>
        <div className="mt-4">
          <DeleteEventButton
            eventId={event.id}
            eventTitle={event.title}
            eventStatus={event.status}
            mode="organizer"
            redirectTo="/organizer/events"
          />
        </div>
      </section>
    </div>
  );
}

