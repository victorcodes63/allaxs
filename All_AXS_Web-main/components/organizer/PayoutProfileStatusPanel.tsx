"use client";

import type { ReactElement } from "react";
import type { OrganizerPayoutProfileStatus } from "@/lib/organizer-payout-profile";

export function PayoutProfileStatusPanel({
  status,
}: {
  status: OrganizerPayoutProfileStatus;
}): ReactElement {
  const { isComplete, missingItems, adminVerified, readyForSettlement } = status;

  return (
    <section
      aria-labelledby="payout-profile-status-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
    >
      <h2
        id="payout-profile-status-heading"
        className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
      >
        Payout profile status
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Finance-grade profile: legal identity, tax reference, reachable support contacts, and
        structured payout details. Verification is completed by All AXS after document checks.
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted">Form completeness</dt>
          <dd className="mt-1">
            <span
              className={
                isComplete
                  ? "inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100"
                  : "inline-flex rounded-full border border-amber-400/30 bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100"
              }
            >
              {isComplete ? "Complete" : "Incomplete"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Admin verification</dt>
          <dd className="mt-1">
            <span
              className={
                adminVerified
                  ? "inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100"
                  : "inline-flex rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted"
              }
            >
              {adminVerified ? "Verified" : "Pending review"}
            </span>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted">Ready for settlement</dt>
          <dd className="mt-1">
            <span
              className={
                readyForSettlement
                  ? "inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100"
                  : "inline-flex rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted"
              }
            >
              {readyForSettlement ? "Yes" : "No"}
            </span>
            {!readyForSettlement ? (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Requires a complete profile and admin verification before payouts are cleared for
                high-trust settlement runs.
              </p>
            ) : null}
          </dd>
        </div>
      </dl>

      {!isComplete && missingItems.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-400/25 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
            Still needed
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-50/95">
            {missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
