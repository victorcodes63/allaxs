"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EventStatus } from "@/lib/validation/event";

const ORGANIZER_DELETABLE_STATUSES = new Set<string>([
  EventStatus.DRAFT,
  EventStatus.PENDING_REVIEW,
  EventStatus.REJECTED,
]);

export interface DeleteEventButtonProps {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  /** Organizer flows hide the action unless the event is still editable. */
  mode: "organizer" | "admin";
  /** Shown in admin confirm copy when the event has sales history. */
  paidOrderCount?: number;
  redirectTo: string;
  className?: string;
  buttonLabel?: string;
  onDeleted?: () => void;
}

export function DeleteEventButton({
  eventId,
  eventTitle,
  eventStatus,
  mode,
  paidOrderCount = 0,
  redirectTo,
  className = "",
  buttonLabel = "Delete event",
  onDeleted,
}: DeleteEventButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "organizer" && !ORGANIZER_DELETABLE_STATUSES.has(eventStatus)) {
    return null;
  }

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setError(null);
  };

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await axios.delete(`/api/events/${eventId}`);
      onDeleted?.();
      if (onDeleted) {
        setOpen(false);
      } else {
        router.push(redirectTo);
      }
    } catch (err) {
      const fallback = "Failed to delete event. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (
          err.response?.data as { message?: string } | undefined
        )?.message;
        if (status === 403) {
          setError("You do not have permission to delete this event.");
        } else if (status === 404) {
          setError("Event not found.");
        } else if (status === 400) {
          setError(apiMessage ?? "This event cannot be deleted right now.");
        } else {
          setError(apiMessage ?? err.message ?? fallback);
        }
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const description =
    mode === "admin" ? (
      <>
        Permanently delete{" "}
        <span className="font-semibold text-foreground">{eventTitle}</span>?
        This removes the event, ticket tiers, coupons, and related records from
        the platform.
        {paidOrderCount > 0 ? (
          <>
            {" "}
            <span className="font-semibold text-red-100">
              {paidOrderCount} paid order{paidOrderCount === 1 ? "" : "s"} will
              also be removed.
            </span>
          </>
        ) : null}{" "}
        Admin deletions are recorded in the audit log. This cannot be undone.
      </>
    ) : (
      <>
        Permanently delete{" "}
        <span className="font-semibold text-foreground">{eventTitle}</span>?
        Draft and rejected events can be removed when they have no paid orders.
        This cannot be undone.
      </>
    );

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={`border-red-400/35 text-red-100 hover:border-red-400/55 hover:bg-red-500/10 sm:w-auto ${className}`}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={mode === "admin" ? "Delete event (admin)" : "Delete event"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="sm:w-auto"
              disabled={submitting}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="border-red-400/35 bg-red-600 text-white hover:bg-red-700 sm:w-auto"
              disabled={submitting}
              onClick={() => void handleDelete()}
            >
              {submitting ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted">
          <p>{description}</p>
          {error ? (
            <p className="rounded-[var(--radius-button)] border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-100">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
