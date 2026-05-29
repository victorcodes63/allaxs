"use client";

import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface ReassignOrderBuyerTarget {
  id: string;
  reference?: string | null;
  email: string;
  status: string;
}

interface ReassignOrderBuyerDialogProps {
  order: ReassignOrderBuyerTarget | null;
  onClose: () => void;
  onReassigned: (message: string) => void;
}

/**
 * Admin flow to correct a typo in the checkout buyer email on a paid order.
 * Updates order + ticket ownership and optionally resends tickets.
 */
export function ReassignOrderBuyerDialog({
  order,
  onClose,
  onReassigned,
}: ReassignOrderBuyerDialogProps) {
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [resendTickets, setResendTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setNewEmail("");
    setReason("");
    setResendTickets(true);
    setError(null);
  }, [order?.id]);

  if (!order) return null;

  const submit = async () => {
    setError(null);
    const trimmed = newEmail.trim();
    if (!trimmed) {
      setError("Enter the corrected buyer email.");
      return;
    }
    if (trimmed.toLowerCase() === order.email.trim().toLowerCase()) {
      setError("New email must differ from the current buyer email.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post<{
        previousEmail: string;
        newEmail: string;
        ticketCount: number;
        ticketsResent: boolean;
      }>(`/api/admin/orders/${order.id}/reassign-buyer`, {
        newEmail: trimmed,
        reason: reason.trim() || undefined,
        resendTickets,
      });

      const { previousEmail, newEmail: corrected, ticketCount, ticketsResent } =
        response.data;
      let message = `Buyer email updated from ${previousEmail} to ${corrected} (${ticketCount} ticket${ticketCount === 1 ? "" : "s"} relinked).`;
      if (ticketsResent) {
        message += " Tickets emailed to the corrected address.";
      }
      onReassigned(message);
    } catch (err) {
      const fallback = "Failed to reassign buyer email. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (err.response?.data as { message?: string } | undefined)
          ?.message;
        if (status === 400) {
          setError(apiMessage ?? "This order cannot be reassigned right now.");
        } else if (status === 403) {
          setError("You do not have permission to reassign buyer emails.");
        } else if (status === 404) {
          setError("Order not found.");
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

  return (
    <Dialog
      open={!!order}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Reassign buyer email"
      ariaLabel="Reassign buyer email dialog"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={submitting}
            className="w-auto"
          >
            {submitting ? "Saving…" : "Reassign & relink tickets"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-muted">
          Use this when checkout captured the wrong email (typo). The order and
          all tickets move to the corrected address and attendee account.
        </p>

        <dl className="grid grid-cols-1 gap-2 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Reference
            </dt>
            <dd className="mt-0.5 truncate text-foreground/90">
              {order.reference || order.id.slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Current buyer
            </dt>
            <dd className="mt-0.5 truncate text-foreground/90">{order.email}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Status
            </dt>
            <dd className="mt-0.5 text-foreground/90">
              {order.status.replace(/_/g, " ")}
            </dd>
          </div>
        </dl>

        <Input
          label="Corrected buyer email"
          type="email"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          placeholder="buyer@example.com"
          autoComplete="email"
        />

        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Typo at guest checkout — buyer confirmed correct address."
          rows={3}
        />

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground/90">
          <input
            type="checkbox"
            checked={resendTickets}
            onChange={(event) => setResendTickets(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-primary focus:ring-primary/30"
          />
          <span>
            Email tickets to the corrected address after reassignment
          </span>
        </label>

        <p className="text-xs leading-relaxed text-muted">
          Only paid orders with issued tickets can be reassigned. The action is
          logged in the admin audit trail.
        </p>
      </div>
    </Dialog>
  );
}
