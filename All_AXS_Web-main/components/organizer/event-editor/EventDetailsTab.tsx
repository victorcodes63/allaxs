"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  eventDetailsSchema,
  type EventDetailsInput,
  EventType,
  EventStatus,
} from "@/lib/validation/event";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";

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
  [key: string]: unknown; // Allow additional properties to match parent component interface
}

interface EventDetailsTabProps {
  event: Event;
  onEventUpdate: (event: Event) => void;
  /**
   * Set by the admin editor route to bypass the organizer-only status gate
   * (`DRAFT | PENDING_REVIEW | REJECTED`) so admins can correct typos on
   * already-published events, and to hide the "Submit for Review" button
   * (which is irrelevant for admin overrides). Backend audit-logs the
   * resulting PATCH as ADMIN_UPDATE_EVENT.
   */
  canEditOverride?: boolean;
}

export function EventDetailsTab({
  event,
  onEventUpdate,
  canEditOverride = false,
}: EventDetailsTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<EventDetailsInput>({
    resolver: zodResolver(eventDetailsSchema),
    mode: "onChange",
    defaultValues: {
      title: event.title,
      type: event.type as EventType,
      venue: event.venue || "",
      startsAt: event.startAt
        ? new Date(event.startAt).toISOString().slice(0, 16)
        : "",
      endsAt: event.endAt
        ? new Date(event.endAt).toISOString().slice(0, 16)
        : "",
      description: event.description || "",
    },
  });

  const eventType = watch("type");
  const isEditable =
    canEditOverride ||
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW ||
    event.status === EventStatus.REJECTED;
  // Admins editing as an override don't submit for review — they're either
  // approving via the moderation queue or fixing live event copy.
  const canSubmitForReview =
    !canEditOverride &&
    (event.status === EventStatus.DRAFT ||
      event.status === EventStatus.REJECTED);

  useEffect(() => {
    // Convert ISO date strings to datetime-local format (YYYY-MM-DDTHH:mm)
    // datetime-local input expects local time, so we convert from ISO (UTC) to local
    const formatDateTimeLocal = (isoString: string): string => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        // Check if date is valid
        if (isNaN(date.getTime())) return "";
        // Get local date/time components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return "";
      }
    };

    reset({
      title: event.title,
      type: event.type as EventType,
      venue: event.venue || "",
      startsAt: formatDateTimeLocal(event.startAt),
      endsAt: formatDateTimeLocal(event.endAt),
      description: event.description || "",
    });
  }, [event, reset]);

  const onSubmit = async (data: EventDetailsInput) => {
    if (!isEditable) {
      setError("Event cannot be edited in its current status");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string
      // The datetime-local input provides local time, which we convert to ISO for the backend
      const updateData = {
        ...data,
        startsAt: new Date(data.startsAt).toISOString(),
        endsAt: new Date(data.endsAt).toISOString(),
      };

      const response = await axios.patch(`/api/events/${event.id}`, updateData);
      const updatedEvent = response.data;
      onEventUpdate(updatedEvent);
      setSuccess("Event updated successfully");
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      
      // Handle validation errors (400) - backend may return array of messages
      if (axiosError.response?.status === 400) {
        const message = axiosError.response.data?.message;
        if (Array.isArray(message)) {
          setError(message.join(", "));
        } else {
          setError(message || "Validation failed. Please check your input.");
        }
      } else if (axiosError.response?.status === 403) {
        setError("You do not have permission to edit this event");
      } else if (axiosError.response?.status === 404) {
        setError("Event not found");
      } else {
        const message =
          axiosError.response?.data?.message || "Failed to update event";
        setError(typeof message === "string" ? message : "An error occurred");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!canSubmitForReview) {
      setError("Event can only be submitted from draft or rejected status");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await axios.post(`/api/events/${event.id}/submit`);
      onEventUpdate(response.data);
      setSuccess("Event submitted for review");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      
      if (axiosError.response?.status === 403) {
        setError("You do not have permission to submit this event");
      } else if (axiosError.response?.status === 404) {
        setError("Event not found");
      } else {
        const message =
          axiosError.response?.data?.message || "Failed to submit event";
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Display */}
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Status
            </p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                event.status,
              )}`}
            >
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Slug
            </p>
            <p className="truncate font-mono text-sm text-foreground/90">{event.slug}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/12 p-3 text-sm text-emerald-100">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Title *"
          type="text"
          placeholder="Event Title"
          {...register("title")}
          error={errors.title?.message}
          disabled={!isEditable}
        />

        <div>
          <label
            htmlFor="event-type"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Type *
          </label>
          <select
            id="event-type"
            {...register("type")}
            aria-invalid={errors.type ? "true" : "false"}
            aria-describedby={errors.type ? "event-type-error" : undefined}
            className={nativeDarkControlClass(!!errors.type)}
            disabled={!isEditable}
          >
            <option value={EventType.IN_PERSON}>In Person</option>
            <option value={EventType.VIRTUAL}>Virtual</option>
            <option value={EventType.HYBRID}>Hybrid</option>
          </select>
          {errors.type && (
            <p id="event-type-error" className="mt-1 text-sm text-primary" role="alert">
              {errors.type.message}
            </p>
          )}
        </div>

        {(eventType === EventType.IN_PERSON ||
          eventType === EventType.HYBRID) && (
          <Input
            label="Venue *"
            type="text"
            placeholder="Event Venue"
            {...register("venue")}
            error={errors.venue?.message}
            disabled={!isEditable}
          />
        )}

        <Input
          label="Start Date & Time *"
          type="datetime-local"
          {...register("startsAt")}
          error={errors.startsAt?.message}
          disabled={!isEditable}
        />

        <Input
          label="End Date & Time *"
          type="datetime-local"
          {...register("endsAt")}
          error={errors.endsAt?.message}
          disabled={!isEditable}
        />

        <Textarea
          label="Description"
          rows={6}
          placeholder="Event description..."
          {...register("description")}
          error={errors.description?.message}
          disabled={!isEditable}
        />

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={!isEditable || isSaving}
            className="flex-1"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          {canSubmitForReview && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSubmitForReview}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting
                ? "Submitting..."
                : event.status === EventStatus.REJECTED
                  ? "Resubmit for Review"
                  : "Submit for Review"}
            </Button>
          )}
        </div>

        {!isEditable && (
          <p className="text-sm text-muted">
            This event cannot be edited in its current status. Only events in
            DRAFT, PENDING_REVIEW, or REJECTED status can be edited.
          </p>
        )}
      </form>
    </div>
  );
}

