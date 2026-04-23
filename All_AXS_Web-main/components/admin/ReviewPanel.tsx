"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import axios from "axios";

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

interface ReviewPanelProps {
  event: Event | null;
  onClose: () => void;
  onActionComplete: () => void;
}

export function ReviewPanel({
  event,
  onClose,
  onActionComplete,
}: ReviewPanelProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!event) return null;

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve this event?")) {
      return;
    }

    setIsApproving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await axios.post(`/api/admin/events/${event.id}/approve`);
      setSuccessMessage("Event approved successfully!");
      setTimeout(() => {
        onActionComplete();
        onClose();
      }, 1000);
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 403) {
        setError("You do not have permission to approve events");
      } else if (axiosError.response?.status === 400) {
        setError(
          axiosError.response.data?.message ||
            "Event cannot be approved (may have already been moderated)"
        );
      } else if (axiosError.response?.status === 409 || axiosError.response?.status === 412) {
        setError("Event has already been moderated by another admin");
      } else {
        setError(
          axiosError.response?.data?.message ||
            "Failed to approve event. Please try again."
        );
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await axios.post(`/api/admin/events/${event.id}/reject`, {
        reason: rejectReason || undefined,
      });
      setSuccessMessage("Event rejected successfully!");
      setRejectDialogOpen(false);
      setRejectReason("");
      setTimeout(() => {
        onActionComplete();
        onClose();
      }, 1000);
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosError.response?.status === 403) {
        setError("You do not have permission to reject events");
      } else if (axiosError.response?.status === 400) {
        setError(
          axiosError.response.data?.message ||
            "Event cannot be rejected (may have already been moderated)"
        );
      } else if (axiosError.response?.status === 409 || axiosError.response?.status === 412) {
        setError("Event has already been moderated by another admin");
      } else {
        setError(
          axiosError.response?.data?.message ||
            "Failed to reject event. Please try again."
        );
      }
    } finally {
      setIsRejecting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
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

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <>
      <Dialog
        open={!!event}
        onClose={onClose}
        title="Review Event"
        ariaLabel="Event review panel"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isApproving || isRejecting}
              className="w-auto"
            >
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => setRejectDialogOpen(true)}
              disabled={isApproving || isRejecting}
              className="w-auto bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="w-auto"
            >
              {isApproving ? "Approving..." : "Approve"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
              {successMessage}
            </div>
          )}

          {/* Event Title */}
          <div>
            <h3 className="text-xl font-bold mb-2">{event.title}</h3>
            <p className="text-sm text-black/60">
              Submitted: {formatDate(event.createdAt)}
            </p>
          </div>

          {/* Banner Preview */}
          {event.bannerUrl && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Banner
              </label>
              <div className="relative w-full h-48 rounded-lg border border-black/10 overflow-hidden">
                <Image
                  src={getBannerUrl(event.bannerUrl) || ""}
                  alt={`${event.title} banner`}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Description
              </label>
              <p className="text-sm text-black/80 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Type
            </label>
            <p className="text-sm text-black/80">{getTypeLabel(event.type)}</p>
          </div>

          {/* Venue (for in-person/hybrid) */}
          {(event.type === "IN_PERSON" || event.type === "HYBRID") &&
            event.venue && (
              <div>
                <label className="block text-sm font-medium mb-2 text-black">
                  Venue
                </label>
                <p className="text-sm text-black/80">{event.venue}</p>
                {(event.city || event.country) && (
                  <p className="text-sm text-black/60">
                    {[event.city, event.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            )}

          {/* Dates */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Event Dates
            </label>
            <div className="space-y-1">
              <p className="text-sm text-black/80">
                <strong>Start:</strong> {formatDate(event.startAt)}
              </p>
              <p className="text-sm text-black/80">
                <strong>End:</strong> {formatDate(event.endAt)}
              </p>
            </div>
          </div>

          {/* Organizer Info */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Organizer
            </label>
            <div className="space-y-1">
              <p className="text-sm text-black/80">{event.organizer.orgName}</p>
              {event.organizer.user && (
                <p className="text-sm text-black/60">
                  {event.organizer.user.name || event.organizer.user.email}
                </p>
              )}
              {event.organizer.user?.email && (
                <p className="text-sm text-black/60">
                  {event.organizer.user.email}
                </p>
              )}
            </div>
          </div>

          {/* Ticket Types Count */}
          {event.ticketTypes && event.ticketTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Ticket Tiers
              </label>
              <p className="text-sm text-black/80">
                {event.ticketTypes.length} tier(s) configured
              </p>
            </div>
          )}

          {/* Previous Rejection Reason */}
          {event.metadata?.rejectionReason && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Previous Rejection Reason
              </label>
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {event.metadata.rejectionReason}
              </p>
            </div>
          )}
        </div>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          setRejectDialogOpen(false);
          setRejectReason("");
          setError(null);
        }}
        title="Reject Event"
        ariaLabel="Reject event dialog"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
                setError(null);
              }}
              disabled={isRejecting}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReject}
              disabled={isRejecting}
              className="w-auto bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? "Rejecting..." : "Reject Event"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-black/80">
            Please provide an optional reason for rejecting this event. This
            will be visible to the organizer.
          </p>

          <Textarea
            label="Rejection Reason (Optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Event does not meet our guidelines..."
            rows={4}
            aria-label="Rejection reason"
          />
        </div>
      </Dialog>
    </>
  );
}

