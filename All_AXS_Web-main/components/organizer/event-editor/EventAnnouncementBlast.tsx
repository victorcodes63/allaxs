"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  fetchAnnouncementRecipients,
  sendEventAnnouncement,
} from "@/lib/event-announcements-api";

export function EventAnnouncementBlast({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    setRecipientsError(null);
    try {
      const data = await fetchAnnouncementRecipients(eventId);
      setRecipientCount(data.recipientCount);
    } catch (err) {
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string })?.message;
        setRecipientsError(msg || "Could not load recipient count.");
      } else {
        setRecipientsError("Could not load recipient count.");
      }
      setRecipientCount(null);
    } finally {
      setLoadingRecipients(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const canCompose =
    !loadingRecipients &&
    recipientCount !== null &&
    recipientCount > 0 &&
    subject.trim().length > 0 &&
    bodyHtml.trim().length > 0;

  const openConfirm = () => {
    setSendError(null);
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      const result = await sendEventAnnouncement(eventId, {
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
      });
      setConfirmOpen(false);
      if (result.failedCount > 0) {
        setSuccessMessage(
          `Sent to ${result.sentCount} of ${result.recipientCount} buyer${
            result.recipientCount === 1 ? "" : "s"
          }. ${result.failedCount} failed — check server logs or try again later.`,
        );
      } else {
        setSuccessMessage(
          `Announcement sent to ${result.sentCount} buyer${
            result.sentCount === 1 ? "" : "s"
          }.`,
        );
      }
      setSubject("");
      setBodyHtml("");
      window.setTimeout(() => setSuccessMessage(null), 6000);
      void loadRecipients();
    } catch (err) {
      if (isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string })?.message;
        setSendError(msg || "Failed to send announcement.");
      } else {
        setSendError("Failed to send announcement.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-background/80 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Email buyers
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Send one message to every distinct email on{" "}
            <span className="font-medium text-foreground">paid</span> orders for{" "}
            <span className="font-medium text-foreground">{eventTitle}</span>.
            Use simple HTML (paragraphs, links, bold) — it is wrapped in the
            standard All AXS email layout.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-auto shrink-0"
          onClick={() => void loadRecipients()}
          disabled={loadingRecipients}
        >
          Refresh count
        </Button>
      </div>

      {successMessage ? (
        <div
          className="mt-4 rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {recipientsError ? (
        <div
          className="mt-4 rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {recipientsError}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        {loadingRecipients ? (
          "Counting paid buyers…"
        ) : recipientCount === null ? (
          "Recipient count unavailable."
        ) : recipientCount === 0 ? (
          "No paid buyers with email addresses yet — announcements are disabled until you have sales."
        ) : (
          <>
            <span className="font-semibold text-foreground tabular-nums">
              {recipientCount}
            </span>{" "}
            unique buyer email{recipientCount === 1 ? "" : "s"} will receive this
            message.
          </>
        )}
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Subject
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            disabled={recipientCount === 0}
            placeholder="e.g. Venue update for Saturday"
            className="mt-2 w-full rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Message (HTML)
          </span>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            maxLength={50000}
            rows={8}
            disabled={recipientCount === 0}
            placeholder={'<p>Doors open at 6pm. Bring your ticket PDF.</p>'}
            className="mt-2 w-full rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!canCompose}
            onClick={openConfirm}
          >
            Review &amp; send
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!sending) setConfirmOpen(false);
        }}
        title="Send announcement?"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={sending} onClick={() => void handleSend()}>
              {sending ? "Sending…" : "Send now"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You are about to email{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {recipientCount ?? 0}
          </span>{" "}
          paid buyer{(recipientCount ?? 0) === 1 ? "" : "s"} for{" "}
          <span className="font-semibold text-foreground">{eventTitle}</span>.
        </p>
        <p className="mt-3 text-sm">
          <span className="text-muted">Subject:</span>{" "}
          <span className="font-medium text-foreground">{subject.trim()}</span>
        </p>
        {sendError ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {sendError}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">
          Sending is rate-limited on the server. Large lists may take a minute to
          complete.
        </p>
      </Dialog>
    </div>
  );
}
