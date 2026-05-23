"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";

type Variant = "primary" | "secondary";

export function DuplicateEventButton({
  eventId,
  eventTitle,
  variant = "secondary",
  className = "",
  /** When true, navigate to the new draft's editor after a successful duplicate. */
  redirectAfter = true,
  onDuplicated,
}: {
  eventId: string;
  eventTitle?: string;
  variant?: Variant;
  className?: string;
  redirectAfter?: boolean;
  onDuplicated?: (newEventId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (
      !confirm(
        eventTitle
          ? `Create a draft copy of "${eventTitle}"?`
          : "Create a draft copy of this event?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`/api/events/${eventId}/duplicate`);
      const newId =
        (res.data && typeof res.data === "object" && "id" in res.data)
          ? (res.data as { id: string }).id
          : null;
      if (onDuplicated && newId) onDuplicated(newId);
      if (redirectAfter && newId) {
        router.push(`/organizer/events/${newId}/edit`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not duplicate this event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        className={className || "w-auto"}
        onClick={() => void handleClick()}
        disabled={busy}
      >
        {busy ? "Duplicating…" : "Duplicate event"}
      </Button>
      {error ? (
        <p className="text-xs text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
