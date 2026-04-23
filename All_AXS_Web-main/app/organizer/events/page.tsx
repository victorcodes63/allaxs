"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EventStatus } from "@/lib/validation/event";

interface Event {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  venue?: string;
  slug: string;
  bannerUrl?: string | null;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
}

export default function EventsListPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/events");
        setEvents(response.data);
        setError(null);
      } catch (err) {
        const axiosError = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        
        if (axiosError.response?.status === 403) {
          setError("You do not have permission to view events");
        } else {
          const message =
            axiosError.response?.data?.message || "Failed to load events";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case EventStatus.DRAFT:
        return "bg-gray-100 text-gray-800";
      case EventStatus.PENDING_REVIEW:
        return "bg-yellow-100 text-yellow-800";
      case EventStatus.PUBLISHED:
        return "bg-green-100 text-green-800";
      case EventStatus.REJECTED:
        return "bg-red-100 text-red-800";
      case EventStatus.ARCHIVED:
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBannerUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (typeof window !== "undefined") {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      return `${apiUrl}${url.startsWith("/") ? url : `/${url}`}`;
    }
    return url;
  };

  const filteredEvents =
    statusFilter === "all"
      ? events
      : events.filter((event) => event.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-primary">{error}</p>
          <Link
            href="/organizer/dashboard"
            className="mt-4 inline-block text-sm text-black/60 hover:text-black"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Events</h1>
          <p className="text-lg text-black/60">
            Manage and edit your events
          </p>
        </div>
        <Link href="/organizer/events/new">
          <Button>Create Event</Button>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-black">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-black/20 rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        >
          <option value="all">All</option>
          <option value={EventStatus.DRAFT}>Draft</option>
          <option value={EventStatus.PENDING_REVIEW}>Pending Review</option>
          <option value={EventStatus.PUBLISHED}>Published</option>
          <option value={EventStatus.REJECTED}>Rejected</option>
          <option value={EventStatus.ARCHIVED}>Archived</option>
        </select>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-black/5 rounded-lg p-12 text-center">
          <p className="text-lg text-black/60 mb-4">
            {statusFilter === "all"
              ? "No events yet. Create your first event to get started!"
              : `No events with status "${statusFilter}".`}
          </p>
          {statusFilter === "all" && (
            <Link href="/organizer/events/new">
              <Button>Create Your First Event</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="border border-black/10 rounded-lg overflow-hidden hover:border-primary transition-colors bg-white"
            >
              <div className="flex">
                {/* Banner Thumbnail */}
                {event.bannerUrl ? (
                  <div className="w-32 h-32 flex-shrink-0 bg-black/5 overflow-hidden relative">
                    <Image
                      src={getBannerUrl(event.bannerUrl) || ""}
                      alt={`${event.title} banner`}
                      fill
                      className="object-cover"
                      sizes="128px"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 flex-shrink-0 bg-black/5 flex items-center justify-center">
                    <span className="text-xs text-black/40">No banner</span>
                  </div>
                )}
                
                {/* Event Details */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-2">
                        {event.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-black/60 mb-2">
                        <span className="whitespace-nowrap">
                          {formatDate(event.startAt)}
                        </span>
                        <span className="text-black/30">•</span>
                        <span className="whitespace-nowrap">
                          {formatDate(event.endAt)}
                        </span>
                        {event.venue && (
                          <>
                            <span className="text-black/30">•</span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <span>📍</span>
                              {event.venue}
                            </span>
                          </>
                        )}
                        <span className="text-black/30">•</span>
                        <span className="capitalize whitespace-nowrap">
                          {event.type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                      <p className="text-xs text-black/40 font-mono truncate">
                        {event.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status.replace(/_/g, " ")}
                      </span>
                      <Link href={`/organizer/events/${event.id}/edit`}>
                        <Button variant="secondary" className="w-auto whitespace-nowrap">
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

