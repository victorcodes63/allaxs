"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeScannedTicketPayload } from "@/lib/ticket-qr";

type ScanAction = "VERIFY" | "CHECK_IN";

export type ScanTicketApiCode =
  | "OK"
  | "ALREADY_CHECKED_IN"
  | "INVALID_PAYLOAD"
  | "INVALID_SIGNATURE"
  | "UNKNOWN_TICKET"
  | "ORDER_NOT_PAID"
  | "VOID_TICKET"
  | "FORBIDDEN_EVENT";

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

export function TicketScanPanel({
  scanEndpoint,
  title,
  subtitle,
}: {
  scanEndpoint: string;
  title: string;
  subtitle?: string;
}) {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState("");
  const [gateId, setGateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("q") ?? searchParams.get("scan") ?? "";
    if (!fromQuery.trim()) return;
    const normalized = normalizeScannedTicketPayload(fromQuery);
    if (normalized) setPayload(normalized);
  }, [searchParams]);

  useEffect(() => {
    if (!result) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  const run = useCallback(
    async (action: ScanAction) => {
      setBusy(true);
      setResult(null);
      const scanPayload = normalizeScannedTicketPayload(payload) ?? payload.trim();
      if (!scanPayload) {
        setResult({
          ok: false,
          code: "INVALID_PAYLOAD",
          message: "Paste a ticket URL, QR link, or JSON payload from the pass.",
        });
        setBusy(false);
        return;
      }
      try {
        const res = await fetch(scanEndpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: scanPayload,
            action,
            ...(gateId.trim() ? { gateId: gateId.trim() } : {}),
          }),
        });
        const raw = (await res.json().catch(() => ({}))) as unknown;
        const obj = raw as Record<string, unknown>;
        if (!res.ok && typeof obj.code !== "string") {
          const msg = typeof obj.message === "string" ? obj.message : "Request failed";
          setResult({
            ok: false,
            code: "UNKNOWN_TICKET",
            message: msg,
          });
          return;
        }
        setResult(raw as ScanResponse);
      } catch {
        setResult({
          ok: false,
          code: "UNKNOWN_TICKET",
          message: "Network error. Try again.",
        });
      } finally {
        setBusy(false);
      }
    },
    [payload, gateId, scanEndpoint]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && payload.trim()) void run("CHECK_IN");
    }
  };

  const stickyActions = (
    <>
      <button
        type="button"
        disabled={busy || !payload.trim()}
        onClick={() => void run("VERIFY")}
        className="touch-manipulation inline-flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors active:bg-foreground/5 hover:border-primary/45 disabled:pointer-events-none disabled:opacity-45 sm:min-h-[var(--btn-min-h)] sm:flex-none sm:px-4"
      >
        {busy ? (
          <>
            <span className="sm:hidden">…</span>
            <span className="hidden sm:inline">Working…</span>
          </>
        ) : (
          <>
            <span className="sm:hidden">Verify</span>
            <span className="hidden sm:inline">Verify only</span>
          </>
        )}
      </button>
      <button
        type="button"
        disabled={busy || !payload.trim()}
        onClick={() => void run("CHECK_IN")}
        className="touch-manipulation inline-flex min-h-12 flex-[1.35] items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-primary px-3 text-base font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-colors active:opacity-90 hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-45 sm:min-h-[var(--btn-min-h)] sm:flex-none sm:px-5 sm:text-sm"
      >
        {busy ? (
          <>
            <span className="sm:hidden">…</span>
            <span className="hidden sm:inline">Working…</span>
          </>
        ) : (
          "Check in"
        )}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setPayload("");
          setResult(null);
          taRef.current?.focus();
        }}
        className="touch-manipulation inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface text-sm font-semibold text-muted transition-colors active:bg-foreground/5 hover:border-primary/35 disabled:opacity-45 sm:min-h-[var(--btn-min-h)] sm:min-w-0 sm:px-4"
        aria-label="Clear payload"
      >
        <span className="sm:hidden">✕</span>
        <span className="hidden sm:inline">Clear</span>
      </button>
    </>
  );

  return (
    <div className="axs-content-inner mx-auto max-w-2xl space-y-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:space-y-8 sm:pb-16 sm:pt-4">
      <div className="px-0.5 sm:px-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-sm">{subtitle}</p>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-4 sm:p-6 md:p-8 md:space-y-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Scan input</span>
          <textarea
            ref={taRef}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            onKeyDown={onKeyDown}
            rows={5}
            enterKeyHint="go"
            placeholder="Paste ticket URL (allaxs.com/v/…), or legacy JSON from older passes"
            className="min-h-[140px] w-full rounded-[var(--radius-card)] border border-border bg-background px-3 py-3 font-mono text-base leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-h-0 sm:px-4 sm:py-3 sm:text-xs"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Gate / station (optional)
          </span>
          <input
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            placeholder="e.g. Main entrance"
            inputMode="text"
            autoComplete="off"
            className="min-h-12 w-full rounded-[var(--radius-card)] border border-border bg-background px-3 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-h-0 sm:py-2.5 sm:text-sm"
          />
        </label>
        <p className="hidden text-xs leading-relaxed text-muted sm:block">
          USB barcode scanners usually type into the focused field and send <strong>Enter</strong> — we treat Enter
          (without Shift) as <strong>Check in</strong>.
        </p>
        <p className="text-xs leading-relaxed text-muted sm:hidden">
          Tip: use the sticky buttons below after pasting. Scanner <strong>Enter</strong> still checks in.
        </p>
        <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap">{stickyActions}</div>
      </div>

      {result ? (
        <div
          ref={resultRef}
          className={`rounded-[var(--radius-panel)] border p-4 sm:p-6 md:p-8 md:space-y-4 space-y-3 ${resultTone(result.code, result.ok)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Result</span>
            <span className="rounded-full bg-background/80 px-2.5 py-0.5 font-mono text-[11px] text-foreground">
              {result.code}
            </span>
            {result.ok ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Success path</span>
            ) : (
              <span className="text-xs font-semibold text-primary">Rejected</span>
            )}
          </div>
          <p className="text-base font-medium leading-snug text-foreground sm:text-sm sm:font-normal sm:leading-relaxed">
            {result.message}
          </p>
          {result.ticket ? (
            <dl className="grid gap-4 border-t border-border/60 pt-4 text-base sm:grid-cols-2 sm:gap-3 sm:text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Event</dt>
                <dd className="mt-1 font-semibold text-foreground sm:font-medium">{result.ticket.eventTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Tier</dt>
                <dd className="mt-1 font-semibold text-foreground sm:font-medium">{result.ticket.tierName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Attendee</dt>
                <dd className="mt-1 break-all text-foreground">{result.ticket.attendeeEmail}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Status</dt>
                <dd className="mt-1 font-mono text-sm text-foreground sm:text-xs">{result.ticket.status}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Ticket id</dt>
                <dd className="mt-1 break-all font-mono text-xs text-foreground">{result.ticket.id}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}

      {/* Thumb zone on phones: primary actions always reachable */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-surface/95 px-3 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        {stickyActions}
      </div>
    </div>
  );
}
