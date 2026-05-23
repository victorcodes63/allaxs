"use client";

import { useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type TicketTransferPanelProps = {
  ticketId: string;
  currentEmail: string;
  onTransferred?: () => void;
};

export function TicketTransferPanel({
  ticketId,
  currentEmail,
  onTransferred,
}: TicketTransferPanelProps) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    const email = recipientEmail.trim().toLowerCase();
    const name = recipientName.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid recipient email.");
      return;
    }
    if (email === currentEmail.trim().toLowerCase()) {
      setError("Recipient email must be different from the current attendee email.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.post(`/api/tickets/${encodeURIComponent(ticketId)}/transfer`, {
        recipientEmail: email,
        ...(name ? { recipientName: name } : {}),
      });
      setSuccess(`Pass transferred to ${email}. They can sign in with that email to access it.`);
      setRecipientName("");
      setRecipientEmail("");
      onTransferred?.();
    } catch (err) {
      const fallback = "Unable to transfer this pass. Please try again.";
      if (isAxiosError(err)) {
        const apiMessage = (err.response?.data as { message?: string | string[] })?.message;
        setError(
          Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage ?? fallback,
        );
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Transfer ticket</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          Send this pass to someone else. They will receive access under their email and can view
          the QR from their All AXS account.
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[var(--radius-panel)] border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Recipient name"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Optional"
          autoComplete="name"
        />
        <Input
          label="Recipient email"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="friend@example.com"
          autoComplete="email"
          required
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        disabled={submitting}
        onClick={() => void submit()}
      >
        {submitting ? "Transferring…" : "Transfer pass"}
      </Button>
    </section>
  );
}
