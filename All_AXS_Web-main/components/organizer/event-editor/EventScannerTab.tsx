"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  listScannerSessions,
  createScannerSession,
  revokeScannerSession,
  getSessionStatus,
  type ScannerSession,
  type SessionStatus,
} from "@/lib/scanner-sessions-api";

interface EventScannerTabProps {
  eventId: string;
  /** ISO 8601 event end time — used as the default expiry + 1 h */
  eventEndAt?: string;
}

const STATUS_CHIP: Record<SessionStatus, { label: string; cls: string }> = {
  active:  { label: "Active",  cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  expired: { label: "Expired", cls: "bg-amber-500/10  text-amber-300  border-amber-500/30"    },
  revoked: { label: "Revoked", cls: "bg-zinc-500/10   text-zinc-400   border-zinc-500/30"     },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Formats an ISO string for <input type="datetime-local"> (no seconds, local TZ). */
function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventScannerTab({ eventId, eventEndAt }: EventScannerTabProps) {
  const [sessions, setSessions] = useState<ScannerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formZone, setFormZone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);

  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((msg: string) => {
    setBanner(msg);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listScannerSessions(eventId);
      setSessions(data);
      setError(null);
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string })?.message ?? err.message)
        : "Failed to load scanner sessions.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDialog = () => {
    setFormLabel("");
    // Default expiry: event end + 1 hour, or now + 6 hours
    const base = eventEndAt ? new Date(eventEndAt) : new Date();
    base.setHours(base.getHours() + 1);
    setFormExpiry(toLocalInputValue(base.toISOString()));
    setFormZone("");
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formLabel.trim()) {
      setFormError("Label is required.");
      return;
    }
    if (!formExpiry) {
      setFormError("Expiry date/time is required.");
      return;
    }
    const expiresAt = new Date(formExpiry).toISOString();
    if (new Date(expiresAt) <= new Date()) {
      setFormError("Expiry must be in the future.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createScannerSession(eventId, {
        label: formLabel.trim(),
        expiresAt,
        zoneScope: formZone.trim() || undefined,
      });
      setSessions((prev) => [created, ...prev]);
      setDialogOpen(false);
      showBanner(`Scanner link "${created.label}" created.`);
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string })?.message ?? err.message)
        : "Failed to create scanner session.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (session: ScannerSession) => {
    if (!window.confirm(`Revoke "${session.label}"? Volunteers using this link will be locked out immediately.`))
      return;
    setRevokingId(session.id);
    try {
      const updated = await revokeScannerSession(eventId, session.id);
      setSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      showBanner(`"${session.label}" revoked.`);
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string })?.message ?? err.message)
        : "Failed to revoke session.";
      setError(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const copyLink = async (session: ScannerSession) => {
    try {
      await navigator.clipboard.writeText(session.scanUrl);
      setCopiedId(session.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this scanner URL:", session.scanUrl);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Scanner Links</h3>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Generate time-limited links for door volunteers. Each link opens
            the scanner directly — no account needed. Share via QR or copy
            the URL.
          </p>
        </div>
        <Button onClick={openDialog} className="w-auto">
          Create Scanner Link
        </Button>
      </header>

      {banner && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          {banner}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 px-5 py-8 text-center">
          <p className="text-sm text-muted">No scanner links yet.</p>
          <p className="mt-1 text-xs text-muted/60">
            Create one to let volunteers scan tickets at the door.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-panel)] border border-border bg-surface/60">
          {sessions.map((s) => {
            const status = getSessionStatus(s);
            const chip = STATUS_CHIP[status];
            const isActive = status === "active";

            return (
              <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chip.cls}`}
                    >
                      {chip.label}
                    </span>
                    {s.zoneScope && (
                      <span className="rounded bg-wash px-1.5 py-0.5 text-xs text-muted">
                        Zone: {s.zoneScope}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {status === "revoked"
                      ? `Revoked ${fmt(s.revokedAt!)}`
                      : `Expires ${fmt(s.expiresAt)}`}
                  </p>
                  <p className="truncate text-xs text-muted/50">{s.scanUrl}</p>
                </div>

                {/* QR code for active sessions */}
                {isActive && (
                  <button
                    type="button"
                    aria-label="Toggle QR code"
                    onClick={() =>
                      setExpandedQr((prev) => (prev === s.id ? null : s.id))
                    }
                    className="shrink-0 rounded-md border border-border bg-wash p-1.5 hover:border-primary/40 transition-colors"
                  >
                    <QRCode
                      value={s.scanUrl}
                      size={expandedQr === s.id ? 140 : 48}
                      bgColor="transparent"
                      fgColor="currentColor"
                      className="text-foreground"
                    />
                  </button>
                )}

                <div className="flex shrink-0 gap-2">
                  {isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyLink(s)}
                        className="rounded-md border border-border bg-wash px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
                      >
                        {copiedId === s.id ? "Copied!" : "Copy Link"}
                      </button>
                      <button
                        type="button"
                        disabled={revokingId === s.id}
                        onClick={() => handleRevoke(s)}
                        className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        {revokingId === s.id ? "Revoking…" : "Revoke"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create scanner session dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Create Scanner Link"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="w-auto"
            >
              {submitting ? "Creating…" : "Create Link"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              {formError}
            </div>
          )}

          <Input
            label="Label"
            placeholder="e.g. Main Door, VIP Gate"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            maxLength={80}
            autoFocus
          />

          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Expires at
            </label>
            <input
              type="datetime-local"
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
              className="w-full rounded-[var(--radius-input,6px)] border border-border bg-wash px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <Input
            label="Zone (optional)"
            placeholder="e.g. Floor 1, VIP Area"
            value={formZone}
            onChange={(e) => setFormZone(e.target.value)}
            maxLength={60}
          />

          <p className="text-xs text-muted">
            The scanner link is a one-time-use URL. Volunteers open it on
            their phone — no account required. Revoke it at any time.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
