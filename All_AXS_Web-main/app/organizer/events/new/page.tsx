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
      router.push(`/organizer/events/${response.data.id}/edit`);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Create Event</h1>
          <p className="text-lg text-black/60">
            Fill in the details to create a new event
          </p>
        </div>
        <Link
          href="/organizer/events"
          className="text-sm text-black/60 hover:text-black transition-colors"
        >
          ← Back to Events
        </Link>
      </div>

      {error && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            } rounded-lg px-4 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors`}
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

        <div className="flex gap-3 pt-4">
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

