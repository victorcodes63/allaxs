"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import axios from "axios";
import { getEventBannerUrl, shouldUnoptimizeEventImage } from "@/lib/utils/image";

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
              className="w-auto border-red-400/30 bg-red-500/10 text-red-100 hover:border-red-400/50 hover:bg-red-500/20 hover:text-white"
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
            <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-[var(--radius-panel)] border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          )}

          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {event.title}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Submitted {formatDate(event.createdAt)}
            </p>
          </div>

          {event.bannerUrl && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Banner
              </label>
              <div className="relative h-48 w-full overflow-hidden rounded-[var(--radius-panel)] border border-border bg-wash">
                <Image
                  src={getEventBannerUrl(event.bannerUrl)}
                  alt={`${event.title} banner`}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  unoptimized={shouldUnoptimizeEventImage(
                    getEventBannerUrl(event.bannerUrl),
                  )}
                />
              </div>
            </div>
          )}

          {event.description && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Description
              </label>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                {event.description}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Type
            </label>
            <p className="text-sm text-foreground/85">
              {getTypeLabel(event.type)}
            </p>
          </div>

          {(event.type === "IN_PERSON" || event.type === "HYBRID") &&
            event.venue && (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Venue
                </label>
                <p className="text-sm text-foreground/85">{event.venue}</p>
                {(event.city || event.country) && (
                  <p className="text-sm text-muted">
                    {[event.city, event.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            )}

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Event dates
            </label>
            <div className="space-y-1 text-sm text-foreground/85 tabular-nums">
              <p>
                <span className="font-semibold text-foreground">Start:</span>{" "}
                {formatDate(event.startAt)}
              </p>
              <p>
                <span className="font-semibold text-foreground">End:</span>{" "}
                {formatDate(event.endAt)}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Organiser
            </label>
            <div className="space-y-1">
              <p className="text-sm text-foreground/85">
                {event.organizer.orgName}
              </p>
              {event.organizer.user && (
                <p className="text-sm text-muted">
                  {event.organizer.user.name || event.organizer.user.email}
                </p>
              )}
              {event.organizer.user?.email && (
                <p className="text-sm text-muted">
                  {event.organizer.user.email}
                </p>
              )}
            </div>
          </div>

          {event.ticketTypes && event.ticketTypes.length > 0 && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Ticket tiers
              </label>
              <p className="text-sm text-foreground/85">
                {event.ticketTypes.length} tier
                {event.ticketTypes.length === 1 ? "" : "s"} configured
              </p>
            </div>
          )}

          {event.metadata?.rejectionReason && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Previous rejection reason
              </label>
              <p className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
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
              className="w-auto bg-red-600 text-white hover:bg-red-700"
            >
              {isRejecting ? "Rejecting..." : "Reject Event"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <p className="text-sm leading-relaxed text-foreground/85">
            Please provide an optional reason for rejecting this event. The
            organiser will see it on their event editor.
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

