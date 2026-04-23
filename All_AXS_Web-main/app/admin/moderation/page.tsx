"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { ReviewPanel } from "@/components/admin/ReviewPanel";
import { EventStatus } from "@/lib/validation/event";
import { useAuth } from "@/lib/auth";

interface Organizer {
  id: string;
  orgName: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

interface Event {
  id: string;
  title: string;
  description?: string;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  city?: string;
  country?: string;
  startAt: string;
  endAt: string;
  status: string;
  bannerUrl?: string | null;
  organizer: Organizer;
  ticketTypes?: Array<{ id: string; name: string }>;
  createdAt: string;
  metadata?: {
    rejectionReason?: string;
  };
}

export default function AdminModerationPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(EventStatus.PENDING_REVIEW);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && user) {
      const isAdmin = user.roles?.includes("ADMIN");
      if (!isAdmin) {
        router.replace("/dashboard");
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (statusFilter) {
          params.append("status", statusFilter);
        }
        if (searchQuery) {
          params.append("search", searchQuery);
        }

        const response = await axios.get(`/api/admin/events?${params.toString()}`);
        setEvents(response.data);
      } catch (err) {
        const axiosError = err as {
          response?: { status?: number; data?: { message?: string } };
        };

        if (axiosError.response?.status === 403) {
          setError("You do not have permission to access this page");
          router.replace("/dashboard");
        } else {
          const message =
            axiosError.response?.data?.message || "Failed to load events";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user?.roles?.includes("ADMIN")) {
      fetchEvents();
    }
  }, [statusFilter, searchQuery, user, authLoading, router]);

  const handleEventActionComplete = () => {
    // Refresh events list
    const params = new URLSearchParams();
    if (statusFilter) {
      params.append("status", statusFilter);
    }
    if (searchQuery) {
      params.append("search", searchQuery);
    }

    axios
      .get(`/api/admin/events?${params.toString()}`)
      .then((response) => {
        setEvents(response.data);
        // Show message if item disappeared
        if (selectedEvent && !response.data.find((e: Event) => e.id === selectedEvent.id)) {
          setActionMessage(
            `Event "${selectedEvent.title}" has been moved to ${statusFilter === EventStatus.PENDING_REVIEW ? "PUBLISHED/REJECTED" : "another status"}`
          );
          setTimeout(() => {
            setActionMessage(null);
            setSelectedEvent(null);
          }, 3000);
        } else {
          setSelectedEvent(null);
        }
      })
      .catch(() => {
        // Silently fail, user can refresh manually
      });
  };

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

  const getTypeLabel = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user?.roles?.includes("ADMIN")) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-primary">
            You do not have permission to access this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Event Moderation Queue</h1>
        <p className="text-lg text-black/60">
          Review and approve/reject events submitted by organizers
        </p>
      </div>

      {actionMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-4 text-sm">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-sm font-medium text-black whitespace-nowrap">
            Filter by status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-black/20 rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            aria-label="Filter events by status"
          >
            <option value={EventStatus.PENDING_REVIEW}>Pending Review</option>
            <option value={EventStatus.PUBLISHED}>Published</option>
            <option value={EventStatus.REJECTED}>Rejected</option>
            <option value={EventStatus.DRAFT}>Draft</option>
            <option value={EventStatus.ARCHIVED}>Archived</option>
          </select>
        </div>

        <div className="flex items-center gap-3 flex-1">
          <label className="text-sm font-medium text-black whitespace-nowrap">
            Search:
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, organizer name, or email..."
            className="flex-1 border border-black/20 rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            aria-label="Search events"
          />
        </div>
      </div>

      {/* Events Table/List */}
      {events.length === 0 ? (
        <div className="bg-black/5 rounded-lg p-12 text-center">
          <p className="text-lg text-black/60 mb-4">
            {statusFilter === EventStatus.PENDING_REVIEW
              ? "No events waiting for review"
              : `No events with status "${statusFilter}"`}
          </p>
        </div>
      ) : (
        <div className="border border-black/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Events moderation queue">
              <thead className="bg-black/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Organizer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Starts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Ends
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black/60 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black/10">
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-black/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-black">
                        {event.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-black/80">
                        {event.organizer.orgName}
                      </div>
                      {event.organizer.user?.email && (
                        <div className="text-xs text-black/60">
                          {event.organizer.user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/80">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/80">
                      {formatDate(event.startAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/80">
                      {formatDate(event.endAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/80">
                      {getTypeLabel(event.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedEvent(event)}
                        className="w-auto"
                        aria-label={`Review event: ${event.title}`}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Panel */}
      <ReviewPanel
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onActionComplete={handleEventActionComplete}
      />
    </div>
  );
}

