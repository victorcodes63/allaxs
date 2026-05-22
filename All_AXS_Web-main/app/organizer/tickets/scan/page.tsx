"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import QRCode from "react-qr-code";
import { TicketScanPanel } from "@/components/tickets/TicketScanPanel";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  listOrganizerEvents,
  listScannerSessions,
  createScannerSession,
  revokeScannerSession,
  sendScannerInvite,
  getSessionStatus,
  type OrganizerEventSummary,
  type ScannerSession,
  type SessionStatus,
} from "@/lib/scanner-sessions-api";

// ─── shared helpers ────────────────────────────────────────────────────────

type Tab = "quick-scan" | "volunteer-links";

const STATUS_CHIP: Record<SessionStatus, { label: string; cls: string }> = {
  active:  { label: "Active",  cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  expired: { label: "Expired", cls: "bg-amber-500/10  text-amber-300  border-amber-500/30"    },
  revoked: { label: "Revoked", cls: "bg-zinc-500/10   text-zinc-400   border-zinc-500/30"     },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Volunteer Links panel ─────────────────────────────────────────────────

function VolunteerLinksPanel() {
  const [events, setEvents] = useState<OrganizerEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [sessions, setSessions] = useState<ScannerSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formZone, setFormZone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Per-row state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);

  // Send invite dialog
  const [inviteDialogSession, setInviteDialogSession] = useState<ScannerSession | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (msg: string) => {
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  };

  // Load events once
  useEffect(() => {
    listOrganizerEvents()
      .then((list) => {
        // Show upcoming/active events first; sort by startAt desc
        const sorted = [...list].sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        );
        setEvents(sorted);
        if (sorted[0]) setSelectedEventId(sorted[0].id);
      })
      .catch(() => setError("Failed to load your events."))
      .finally(() => setEventsLoading(false));
  }, []);

  // Load sessions whenever selected event changes
  const loadSessions = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setSessionsLoading(true);
    setError(null);
    try {
      const data = await listScannerSessions(eventId);
      setSessions(data);
    } catch (err) {
      setError(
        isAxiosError(err)
          ? ((err.response?.data as { message?: string })?.message ?? err.message)
          : "Failed to load scanner links.",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) void loadSessions(selectedEventId);
  }, [selectedEventId, loadSessions]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const openDialog = () => {
    setFormLabel("");
    setFormZone("");
    setFormEmail("");
    setFormError(null);
    const base = selectedEvent?.endAt ? new Date(selectedEvent.endAt) : new Date();
    base.setHours(base.getHours() + 1);
    setFormExpiry(toLocalInput(base.toISOString()));
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formLabel.trim()) { setFormError("Label is required."); return; }
    if (!formExpiry) { setFormError("Expiry is required."); return; }
    const expiresAt = new Date(formExpiry).toISOString();
    if (new Date(expiresAt) <= new Date()) { setFormError("Expiry must be in the future."); return; }
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createScannerSession(selectedEventId, {
        label: formLabel.trim(),
        expiresAt,
        zoneScope: formZone.trim() || undefined,
        volunteerEmail: formEmail.trim() || undefined,
      });
      setSessions((prev) => [created, ...prev]);
      setDialogOpen(false);
      showBanner(
        formEmail
          ? `"${created.label}" created and invite sent to ${formEmail}.`
          : `Scanner link "${created.label}" created.`,
      );
    } catch (err) {
      setFormError(
        isAxiosError(err)
          ? ((err.response?.data as { message?: string })?.message ?? err.message)
          : "Failed to create scanner link.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (s: ScannerSession) => {
    if (!window.confirm(`Revoke "${s.label}"? Volunteers using this link will be locked out immediately.`)) return;
    setRevokingId(s.id);
    try {
      const updated = await revokeScannerSession(selectedEventId, s.id);
      setSessions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showBanner(`"${s.label}" revoked.`);
    } catch (err) {
      setError(
        isAxiosError(err)
          ? ((err.response?.data as { message?: string })?.message ?? err.message)
          : "Failed to revoke.",
      );
    } finally {
      setRevokingId(null);
    }
  };

  const copyLink = async (s: ScannerSession) => {
    try {
      await navigator.clipboard.writeText(s.scanUrl);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this scanner URL:", s.scanUrl);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteDialogSession || !inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError(null);
    setInviteSending(true);
    try {
      await sendScannerInvite(selectedEventId, inviteDialogSession.id, inviteEmail.trim());
      setInviteDialogSession(null);
      setInviteEmail("");
      showBanner(`Invite sent to ${inviteEmail}.`);
    } catch (err) {
      setInviteError(
        isAxiosError(err)
          ? ((err.response?.data as { message?: string })?.message ?? err.message)
          : "Failed to send invite.",
      );
    } finally {
      setInviteSending(false);
    }
  };

  if (eventsLoading) {
    return <p className="py-8 text-sm text-muted">Loading your events…</p>;
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 px-5 py-10 text-center">
        <p className="text-sm text-muted">You have no events yet.</p>
        <p className="mt-1 text-xs text-muted/60">Create an event first, then come back to set up scanner links.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Explanation callout */}
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 px-4 py-3">
        <p className="text-sm font-medium text-foreground">How volunteer scanning works</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Create a scanner link for each door or gate. Share the link (or QR code) with your
          volunteer — they open it on their phone and start scanning immediately. No account,
          no login. You can revoke a link instantly if needed, and each link only works for
          one event.
        </p>
      </div>

      {/* Event picker */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="event-picker" className="shrink-0 text-sm font-medium text-foreground">
            Event
          </label>
          <select
            id="event-picker"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="rounded-md border border-border bg-wash px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={openDialog} className="w-auto" disabled={!selectedEventId}>
          + Create Scanner Link
        </Button>
      </div>

      {banner && (
        <div role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {banner}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </div>
      )}

      {/* Sessions list */}
      {sessionsLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm text-muted">No scanner links for this event yet.</p>
          <button
            onClick={openDialog}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Create the first one →
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-panel)] border border-border bg-surface/60">
          {sessions.map((s) => {
            const status = getSessionStatus(s);
            const chip = STATUS_CHIP[status];
            const isActive = status === "active";

            return (
              <li key={s.id} className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  {/* Info block */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{s.label}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
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
                    <p className="truncate text-xs text-muted/40">{s.scanUrl}</p>
                  </div>

                  {/* QR code — active only */}
                  {isActive && (
                    <button
                      type="button"
                      title="Click to enlarge QR code"
                      onClick={() => setExpandedQr((p) => (p === s.id ? null : s.id))}
                      className="shrink-0 rounded-md border border-border bg-white p-1.5 hover:border-primary/40 transition-colors"
                    >
                      <QRCode
                        value={s.scanUrl}
                        size={expandedQr === s.id ? 160 : 56}
                        bgColor="#ffffff"
                        fgColor="#0f0f0f"
                      />
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                {isActive && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(s)}
                      className="rounded-md border border-border bg-wash px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
                    >
                      {copiedId === s.id ? "✓ Copied!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteDialogSession(s);
                        setInviteEmail("");
                        setInviteError(null);
                      }}
                      className="rounded-md border border-border bg-wash px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
                    >
                      Send to Volunteer
                    </button>
                    <button
                      type="button"
                      disabled={revokingId === s.id}
                      onClick={() => handleRevoke(s)}
                      className="rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {revokingId === s.id ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────── */}
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
            <Button onClick={handleCreate} disabled={submitting} className="w-auto">
              {submitting ? "Creating…" : "Create Link"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {formError}
            </div>
          )}

          <Input
            label="Label"
            placeholder='e.g. "Main Door", "VIP Gate", "Back Entrance"'
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            maxLength={80}
            autoFocus
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Expires at</label>
            <input
              type="datetime-local"
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
              className="w-full rounded-[var(--radius-input,6px)] border border-border bg-wash px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <Input
            label="Zone (optional)"
            placeholder='e.g. "Floor 1", "VIP Area"'
            value={formZone}
            onChange={(e) => setFormZone(e.target.value)}
            maxLength={60}
          />

          <div>
            <Input
              label="Send invite to volunteer email (optional)"
              type="email"
              placeholder="volunteer@example.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              maxLength={254}
            />
            <p className="mt-1 text-xs text-muted">
              If provided, the volunteer will receive an email with a button to open the
              scanner directly — no account needed.
            </p>
          </div>
        </div>
      </Dialog>

      {/* ── Send invite dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!inviteDialogSession}
        onClose={() => setInviteDialogSession(null)}
        title={`Send invite — ${inviteDialogSession?.label ?? ""}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setInviteDialogSession(null)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button onClick={handleSendInvite} disabled={inviteSending} className="w-auto">
              {inviteSending ? "Sending…" : "Send Invite"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {inviteError && (
            <div role="alert" className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {inviteError}
            </div>
          )}
          <Input
            label="Volunteer email"
            type="email"
            placeholder="volunteer@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted">
            The volunteer receives an email with a direct link to the scanner — no login
            required. You can send to multiple people by clicking "Send to Volunteer" again
            with a different address.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function OrganizerTicketScanPage() {
  const [tab, setTab] = useState<Tab>("volunteer-links");

  return (
    <div className="w-full min-w-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Door scan</h1>
        <p className="mt-0.5 text-sm text-muted">
          Scan guests yourself, or create links for volunteers to scan at the door.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-0 rounded-lg border border-border bg-surface/60 p-1 w-fit">
        {(["volunteer-links", "quick-scan"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "volunteer-links" ? "Volunteer Links" : "Quick Scan"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "volunteer-links" && <VolunteerLinksPanel />}

      {tab === "quick-scan" && (
        <Suspense fallback={<p className="py-8 text-sm text-muted">Loading scanner…</p>}>
          <TicketScanPanel
            scanEndpoint="/api/organizer/tickets/scan"
            title="Quick Scan"
            subtitle="Paste a ticket URL or scan a QR code directly from this device. Uses a USB barcode scanner? Focus the field and scan — Enter triggers Check In."
          />
        </Suspense>
      )}
    </div>
  );
}
