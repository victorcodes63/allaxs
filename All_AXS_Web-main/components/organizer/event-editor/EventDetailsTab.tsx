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
}

export function EventDetailsTab({
  event,
  onEventUpdate,
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
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW;

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
    if (event.status !== EventStatus.DRAFT) {
      setError("Event can only be submitted from draft status");
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case EventStatus.DRAFT:
        return "bg-gray-100 text-gray-800";
      case EventStatus.PENDING_REVIEW:
        return "bg-yellow-100 text-yellow-800";
      case EventStatus.APPROVED:
        return "bg-blue-100 text-blue-800";
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

  return (
    <div className="space-y-6">
      {/* Status Display */}
      <div className="bg-black/5 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-black/60 mb-1">Status</p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                event.status
              )}`}
            >
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <p className="text-sm text-black/60 mb-1">Slug</p>
            <p className="text-sm font-mono text-black/80">{event.slug}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-lg p-3 text-sm">
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
            className="block font-medium mb-1 text-sm text-black"
          >
            Type *
          </label>
          <select
            id="event-type"
            {...register("type")}
            aria-invalid={errors.type ? "true" : "false"}
            aria-describedby={errors.type ? "event-type-error" : undefined}
            className={`w-full border ${
              errors.type ? "border-primary" : "border-black/20"
            } rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
              !isEditable ? "opacity-50 cursor-not-allowed" : ""
            }`}
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
          {event.status === EventStatus.DRAFT && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSubmitForReview}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          )}
        </div>

        {!isEditable && (
          <p className="text-sm text-black/60">
            This event cannot be edited in its current status. Only events in
            DRAFT or PENDING_REVIEW status can be edited.
          </p>
        )}
      </form>
    </div>
  );
}

