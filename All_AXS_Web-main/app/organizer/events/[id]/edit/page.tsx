"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Tabs } from "@/components/ui/Tabs";
import { EventDetailsTab } from "@/components/organizer/event-editor/EventDetailsTab";
import { EventMediaTab } from "@/components/organizer/event-editor/EventMediaTab";
import { EventTicketTiersTab } from "@/components/organizer/event-editor/EventTicketTiersTab";

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
  [key: string]: unknown; // Allow additional properties to match child component interfaces
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
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-primary">{error || "Event not found"}</p>
          <Link
            href="/organizer/events"
            className="mt-4 inline-block text-sm text-black/60 hover:text-black"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

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
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Edit Event</h1>
          <p className="text-lg text-black/60">{event.title}</p>
        </div>
        <Link
          href="/organizer/events"
          className="text-sm text-black/60 hover:text-black transition-colors"
        >
          ← Back to Events
        </Link>
      </div>

      <Tabs tabs={tabs} defaultTab="details" />
    </div>
  );
}

