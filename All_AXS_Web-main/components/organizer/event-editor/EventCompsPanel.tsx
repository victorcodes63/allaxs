"use client";

import { useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";

interface TicketTierLite {
  id: string;
  name: string;
}

export function EventCompsPanel({
  eventId,
  eventTitle,
  ticketTypes,
}: {
  eventId: string;
  eventTitle: string;
  ticketTypes: TicketTierLite[];
}) {
  const [tierId, setTierId] = useState<string>(ticketTypes[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setName("");
    setQty(1);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!tierId) {
      setError("Choose a ticket tier.");
      return;
    }
    if (!email.trim()) {
      setError("Recipient email is required.");
      return;
    }
    if (qty < 1 || qty > 50) {
      setError("Quantity must be between 1 and 50.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`/api/organizer/events/${eventId}/comp/send`, {
        ticketTypeId: tierId,
        email: email.trim(),
        name: name.trim() || undefined,
        quantity: qty,
      });
      setSuccess(
        `Comp ticket${qty === 1 ? "" : "s"} sent to ${email.trim()}.`,
      );
      reset();
      window.setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not send the complimentary ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-background/80 p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Send complimentary tickets
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Issue free tickets for{" "}
          <span className="font-medium text-foreground">{eventTitle}</span> directly
          to a recipient&apos;s email. They&apos;ll receive the same QR pass as a
          paying buyer.
        </p>
      </div>

      {success ? (
        <div
          className="mb-4 rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {success}
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-4 rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="comp-tier"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Ticket tier
          </label>
          <select
            id="comp-tier"
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className={nativeDarkControlClass(false)}
          >
            {ticketTypes.length === 0 ? (
              <option value="">No tiers available</option>
            ) : (
              ticketTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))
            )}
          </select>
        </div>
        <Input
          label="Quantity"
          type="number"
          min={1}
          max={50}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        />
        <Input
          label="Recipient email"
          type="email"
          placeholder="guest@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Recipient name (optional)"
          type="text"
          placeholder="Guest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          className="w-auto"
          disabled={submitting || ticketTypes.length === 0}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "Sending…" : "Send comp ticket"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          onClick={reset}
          disabled={submitting}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
