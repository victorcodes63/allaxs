"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { rolesIncludeAdmin, userHasRole } from "@/lib/auth/hub-routing";
import { compactTicketRef, type DecodedTicketVerify } from "@/lib/ticket-qr";
import type { ScanTicketApiCode } from "@/components/tickets/TicketScanPanel";

type ScanAction = "VERIFY" | "CHECK_IN";

type ScanResponse = {
  ok: boolean;
  code: ScanTicketApiCode;
  message: string;
  ticket?: {
    id: string;
    status: string;
    eventTitle: string;
    eventSlug: string;
    tierName: string;
    attendeeEmail: string;
    attendeeName: string;
  };
};

function resultTone(code: ScanTicketApiCode, ok: boolean): string {
  if (ok && (code === "OK" || code === "ALREADY_CHECKED_IN")) {
    return code === "ALREADY_CHECKED_IN"
      ? "border-amber-500/50 bg-amber-500/10"
      : "border-emerald-500/45 bg-emerald-500/10";
  }
  return "border-primary/35 bg-wash";
}

export function TicketVerifyLanding({ decoded }: { decoded: DecodedTicketVerify }) {
  const { user, loading: authLoading } = useAuth();
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannerHref, setScannerHref] = useState("/organizer/tickets/scan");

  const roles = useMemo(() => (user?.roles ? user.roles.map((r) => String(r).toUpperCase()) : []), [user]);
  const isAdmin = rolesIncludeAdmin(roles);
  const isOrganizer = userHasRole(user, "ORGANIZER");
  const canScanAtDoor = isAdmin || isOrganizer;

  useEffect(() => {
    const base = isAdmin ? "/admin/scan" : "/organizer/tickets/scan";
    setScannerHref(`${base}?q=${encodeURIComponent(window.location.href)}`);
  }, [isAdmin]);

  const scanEndpoint = isAdmin ? "/api/admin/tickets/scan" : "/api/organizer/tickets/scan";
  const passRef = compactTicketRef(decoded.ticketId);
  const headline = decoded.eventTitle?.trim() || "All AXS pass";
  const tier = decoded.tierName?.trim() || "Ticket";

  const runScan = useCallback(
    async (action: ScanAction) => {
      setScanBusy(true);
      setScanResult(null);
      try {
        const res = await fetch(scanEndpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: decoded.scanPayload, action }),
        });
        const raw = (await res.json().catch(() => ({}))) as unknown;
        const obj = raw as Record<string, unknown>;
        if (!res.ok && typeof obj.code !== "string") {
          setScanResult({
            ok: false,
            code: "UNKNOWN_TICKET",
            message: typeof obj.message === "string" ? obj.message : "Request failed",
          });
          return;
        }
        setScanResult(raw as ScanResponse);
      } catch {
        setScanResult({
          ok: false,
          code: "UNKNOWN_TICKET",
          message: "Network error. Try again.",
        });
      } finally {
        setScanBusy(false);
      }
    },
    [decoded.scanPayload, scanEndpoint]
  );

  useEffect(() => {
    if (authLoading || !canScanAtDoor) return;
    const key = `allaxs_auto_verify_${decoded.ticketId}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    void runScan("VERIFY");
  }, [authLoading, canScanAtDoor, decoded.ticketId, runScan]);

  return (
    <div className="axs-content-inner mx-auto max-w-lg space-y-6 pb-20 pt-6 sm:max-w-xl">
      <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_16px_46px_-22px_rgba(0,0,0,0.25)]">
        <header className="relative overflow-hidden border-b border-border/80 bg-[#080a14] px-6 py-10 text-white sm:px-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 70% at 42% -5%, rgba(240,114,65,0.44), transparent 56%), radial-gradient(75% 55% at 100% 95%, rgba(96,24,72,0.24), transparent 58%), linear-gradient(180deg, rgba(7,11,28,0.95), rgba(6,9,20,0.98))",
            }}
            aria-hidden
          />
          <div className="relative space-y-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">All AXS</p>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
            <p>
              <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">
                {tier}
              </span>
            </p>
            <p className="text-sm text-white/70">
              Pass ref <span className="font-mono font-semibold text-white/90">{passRef}</span>
            </p>
          </div>
        </header>

        <div className="space-y-5 px-6 py-8 sm:px-8">
          <p className="text-center text-sm leading-relaxed text-muted">
            {decoded.isDemo
              ? "Demo ticket — show this screen at the door. Staff with a scanner app can verify or check in below."
              : "Official All AXS digital ticket. Present this screen at entry; door staff will scan to verify."}
          </p>

          {decoded.eventSlug ? (
            <div className="text-center">
              <Link
                href={`/e/${decoded.eventSlug}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                View event details
              </Link>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/tickets/${decoded.ticketId}`}
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
            >
              Open full pass
            </Link>
            <Link
              href="/tickets"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-primary px-5 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
            >
              My tickets
            </Link>
          </div>
        </div>
      </article>

      {canScanAtDoor ? (
        <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold text-foreground">Door staff</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Signed in as {isAdmin ? "platform admin" : "organizer"}. Verify this pass or check the guest in.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={scanBusy}
              onClick={() => void runScan("VERIFY")}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 disabled:opacity-45"
            >
              {scanBusy ? "Working…" : "Verify only"}
            </button>
            <button
              type="button"
              disabled={scanBusy}
              onClick={() => void runScan("CHECK_IN")}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] disabled:opacity-45"
            >
              {scanBusy ? "Working…" : "Check in"}
            </button>
          </div>
          {scanResult ? (
            <div className={`mt-5 rounded-[var(--radius-card)] border p-4 ${resultTone(scanResult.code, scanResult.ok)}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Scan result</p>
              <p className="mt-2 text-sm font-medium text-foreground">{scanResult.message}</p>
              {scanResult.ticket ? (
                <dl className="mt-4 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Event</dt>
                    <dd className="mt-1 font-medium text-foreground">{scanResult.ticket.eventTitle}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Tier</dt>
                    <dd className="mt-1 text-foreground">{scanResult.ticket.tierName}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Attendee</dt>
                    <dd className="mt-1 break-all text-foreground">{scanResult.ticket.attendeeEmail}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-center text-xs text-muted">
            <Link href={scannerHref} className="font-semibold text-primary hover:underline">
              Open full scanner with this pass
            </Link>
          </p>
        </section>
      ) : !authLoading ? (
        <p className="text-center text-xs text-muted">
          Organizers:{" "}
          <Link href="/login?next=/organizer/tickets/scan" className="font-semibold text-primary hover:underline">
            sign in
          </Link>{" "}
          to verify passes at the door.
        </p>
      ) : null}
    </div>
  );
}