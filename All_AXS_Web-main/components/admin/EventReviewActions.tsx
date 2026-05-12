"use client";

import { useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { EventStatus } from "@/lib/validation/event";

interface EventReviewActionsProps {
  event: { id: string; title: string; status: string };
  onActionComplete: () => void;
  /**
   * Optional layout override. Defaults to a horizontal action row suitable
   * for sitting next to a page title in the admin event detail header.
   */
  className?: string;
}

/**
 * Inline approve / reject controls for the admin event detail page. Unlike
 * `ReviewPanel`, this component does not render the full event preview —
 * the surrounding page already shows it. It only owns the action buttons,
 * the themed confirm + reject-reason dialogs, and the request lifecycle.
 */
export function EventReviewActions({
  event,
  onActionComplete,
  className,
}: EventReviewActionsProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (event.status !== EventStatus.PENDING_REVIEW) {
    return null;
  }

  const resolveError = (err: unknown, fallback: string): string => {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const apiMessage = (err.response?.data as { message?: string } | undefined)
        ?.message;
      if (status === 403) return "You do not have permission to perform that action.";
      if (status === 400) return apiMessage ?? "Event cannot be moderated right now.";
      if (status === 404) return "Event not found.";
      if (status === 409 || status === 412) {
        return "Event has already been moderated by another admin.";
      }
      return apiMessage ?? err.message ?? fallback;
    }
    return fallback;
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      await axios.post(`/api/admin/events/${event.id}/approve`);
      setApproveDialogOpen(false);
      onActionComplete();
    } catch (err) {
      setError(resolveError(err, "Failed to approve event. Please try again."));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);
    try {
      await axios.post(`/api/admin/events/${event.id}/reject`, {
        reason: rejectReason || undefined,
      });
      setRejectDialogOpen(false);
      setRejectReason("");
      onActionComplete();
    } catch (err) {
      setError(resolveError(err, "Failed to reject event. Please try again."));
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <>
      <div
        className={
          className ??
          "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
        }
      >
        {error ? (
          <div className="col-span-2 w-full rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRejectDialogOpen(true)}
          disabled={isApproving || isRejecting}
          className="w-full border-red-400/30 bg-red-500/10 text-red-100 hover:border-red-400/50 hover:bg-red-500/20 hover:text-white sm:w-auto"
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => setApproveDialogOpen(true)}
          disabled={isApproving || isRejecting}
          className="w-full sm:w-auto"
        >
          {isApproving ? "Approving…" : "Approve"}
        </Button>
      </div>

      <Dialog
        open={approveDialogOpen}
        onClose={() => {
          if (!isApproving) setApproveDialogOpen(false);
        }}
        title="Approve event?"
        ariaLabel="Approve event confirmation"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isApproving}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              disabled={isApproving}
              className="w-auto"
            >
              {isApproving ? "Approving…" : "Approve & publish"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-foreground/85">
          Approving will publish{" "}
          <span className="font-semibold text-foreground">{event.title}</span> to
          the public events feed and notify the organiser. You can still
          unpublish or archive it later.
        </p>
      </Dialog>

      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          if (!isRejecting) {
            setRejectDialogOpen(false);
            setRejectReason("");
            setError(null);
          }
        }}
        title="Reject event"
        ariaLabel="Reject event with optional reason"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
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
              {isRejecting ? "Rejecting…" : "Reject event"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground/85">
            Optionally share a reason — the organiser will see it on their
            event editor when they reopen the listing.
          </p>
          <Textarea
            label="Rejection reason (optional)"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="e.g. The event description references a venue we don't currently support."
            rows={4}
            aria-label="Rejection reason"
          />
        </div>
      </Dialog>
    </>
  );
}
