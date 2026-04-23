"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
  eventDetailsSchema,
  type EventDetailsInput,
  EventType,
} from "@/lib/validation/event";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import Link from "next/link";

export default function CreateEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EventDetailsInput>({
    resolver: zodResolver(eventDetailsSchema),
    mode: "onChange",
  });

  const eventType = watch("type");

  const onSubmit = async (data: EventDetailsInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Convert datetime-local format to ISO string
      const createData = {
        ...data,
        startsAt: new Date(data.startsAt).toISOString(),
        endsAt: new Date(data.endsAt).toISOString(),
      };

      const response = await axios.post("/api/events", createData);
      
      // Redirect to editor on success
      router.push(`/organizer/events/${response.data.id}/edit?tab=media`);
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
        setError("You do not have permission to create events");
      } else {
        const message =
          axiosError.response?.data?.message || "Failed to create event";
        setError(typeof message === "string" ? message : "An error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Fill in the basics. After you create the event, you&apos;ll land on{" "}
          <span className="font-medium text-foreground/90">Media</span> to upload a
          poster or banner, then add ticket types and submit for review from the
          editor.
        </p>
        <Link
          href="/organizer/events"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          ← Back to events
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-primary/35 bg-primary/10 p-3 text-sm text-primary">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-[var(--radius-panel)] border border-border bg-surface/55 p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8"
      >
        <Input
          label="Title *"
          type="text"
          placeholder="Event Title"
          {...register("title")}
          error={errors.title?.message}
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
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Start Date & Time *"
            type="datetime-local"
            {...register("startsAt")}
            error={errors.startsAt?.message}
          />

          <Input
            label="End Date & Time *"
            type="datetime-local"
            {...register("endsAt")}
            error={errors.endsAt?.message}
          />
        </div>

        <Textarea
          label="Description"
          rows={6}
          placeholder="Event description..."
          {...register("description")}
          error={errors.description?.message}
        />

        <div className="flex gap-3 border-t border-border/80 pt-6">
          <Link href="/organizer/events" className="flex-1">
            <Button type="button" variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </form>
    </div>
  );
}

