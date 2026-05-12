"use client";

/**
 * Admin event editor.
 *
 * Mirrors the organiser editor at /organizer/events/[id]/edit but:
 *   - Loads the event via /api/admin/events/[id] so we get the full
 *     organiser/ticket-tier payload even for non-pending statuses (the
 *     /api/events/[id] endpoint is gated by the organiser role for
 *     non-published events).
 *   - Passes `canEditOverride` into the editor tabs so admins can mutate
 *     PUBLISHED / APPROVED events that organisers can't touch directly.
 *   - Re-uses the same /api/events/[id], /api/events/[id]/banner/commit
 *     and /api/events/[id]/ticket-types endpoints (the backend allows
 *     ADMIN role on those routes and audit-logs each admin mutation).
 *
 * Audit trail: every admin mutation through this page lands in
 * `admin_audit_logs` with action `ADMIN_UPDATE_EVENT`,
 * `ADMIN_UPDATE_EVENT_BANNER`, or `ADMIN_(CREATE|UPDATE|DELETE)_TICKET_TYPE`.
 */

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Tabs } from "@/components/ui/Tabs";
import { EventDetailsTab } from "@/components/organizer/event-editor/EventDetailsTab";
import { EventMediaTab } from "@/components/organizer/event-editor/EventMediaTab";
import { EventTicketTiersTab } from "@/components/organizer/event-editor/EventTicketTiersTab";
import { EventSalesTab } from "@/components/organizer/event-editor/EventSalesTab";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

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
  [key: string]: unknown;
}

interface AdminEvent {
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
  organizer?: {
    id?: string;
    orgName?: string;
    user?: { id?: string; email?: string; name?: string | null };
  };
  [key: string]: unknown;
}

const EDITOR_TAB_IDS = [
  "details",
  "media",
  "ticket-tiers",
  "sales",
] as const;
type EditorTabId = (typeof EDITOR_TAB_IDS)[number];

function isEditorTabId(value: string | null): value is EditorTabId {
  return !!value && (EDITOR_TAB_IDS as readonly string[]).includes(value);
}

function AdminEditorTabsSection({
  event,
  tabs,
}: {
  event: AdminEvent;
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
    return "details";
  }, [searchParams]);

  return (
    <Tabs key={`${event.id}-${qs}`} tabs={tabs} defaultTab={defaultTab} />
  );
}

export default function AdminEventEditorPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        // Use the admin-scoped detail endpoint — it always returns the
        // full organiser/ticket-tier payload regardless of status, whereas
        // /api/events/:id is gated by the organiser role for non-published
        // statuses.
        const response = await axios.get<AdminEvent>(
          `/api/admin/events/${eventId}`,
        );
        setEvent(response.data);
        setError(null);
      } catch (err) {
        if (isAxiosError(err)) {
          const status = err.response?.status;
          const data = err.response?.data as { message?: string } | undefined;
          if (status === 403) {
            setError("Admin access required to edit this event.");
          } else if (status === 404) {
            setError("Event not found.");
            setTimeout(() => {
              router.push("/admin/events");
            }, 2000);
          } else {
            setError(data?.message ?? err.message ?? "Failed to load event.");
          }
        } else {
          setError("Failed to load event.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      void fetchEvent();
    }
  }, [eventId, router]);

  const handleEventUpdate = (
    updatedEvent: AdminEvent | (Partial<AdminEvent> & { id: string }),
  ) => {
    setEvent((prevEvent) => {
      if (!prevEvent) return prevEvent;
      if (
        "title" in updatedEvent &&
        "type" in updatedEvent &&
        "slug" in updatedEvent
      ) {
        return updatedEvent as AdminEvent;
      }
      return { ...prevEvent, ...updatedEvent } as AdminEvent;
    });
  };

  if (loading) {
    return (
      <div className={`${ADMIN_PAGE_SHELL} space-y-4`}>
        <p className="text-sm text-muted">Loading event…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={`${ADMIN_PAGE_SHELL} space-y-4`}>
        <Link
          href="/admin/events"
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to all events
        </Link>
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-100 sm:p-4">
          {error || "Event not found."}
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <EventDetailsTab
          event={event}
          onEventUpdate={handleEventUpdate}
          canEditOverride
        />
      ),
    },
    {
      id: "media",
      label: "Media",
      content: (
        <EventMediaTab
          event={event}
          onEventUpdate={handleEventUpdate}
          canEditOverride
        />
      ),
    },
    {
      id: "ticket-tiers",
      label: "Ticket Tiers",
      content: (
        <EventTicketTiersTab
          event={event}
          onEventUpdate={handleEventUpdate}
          canEditOverride
        />
      ),
    },
    {
      id: "sales",
      label: "Sales",
      content: <EventSalesTab eventId={event.id} eventTitle={event.title} />,
    },
  ];

  const organizerLabel =
    event.organizer?.orgName ||
    event.organizer?.user?.email ||
    event.organizer?.user?.name ||
    "Unknown organiser";

  return (
    <div className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link
            href={`/admin/events/${event.id}`}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Back to event detail
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
              Admin override
            </span>
            <span className="rounded-full border border-border/70 bg-wash/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-xs text-muted">
            Every change here is audit-logged in <code>admin_audit_logs</code>{" "}
            against your admin user. Organiser:{" "}
            <span className="text-foreground/85">{organizerLabel}</span>
          </p>
          <p className="mt-3 text-base font-semibold leading-snug text-foreground sm:text-lg">
            {event.title}
          </p>
        </div>
        <Link
          href={`/admin/events/${event.id}`}
          className="shrink-0 text-sm font-medium text-primary hover:underline sm:pt-1 sm:text-right"
        >
          View inspect page →
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="min-h-[12rem] rounded-[var(--radius-panel)] border border-border bg-surface/40" />
        }
      >
        <AdminEditorTabsSection event={event} tabs={tabs} />
      </Suspense>
    </div>
  );
}
