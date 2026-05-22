# Sub-agent master plan — audit + polish backlog

Orchestrates **all remaining actionable work** across Web + API. Each task is independently assignable via the Cursor Task tool when dependencies are met.

**Repos**

| Alias | Path |
|--------|------|
| **Web** | `All_AXS_Web-main` |
| **API** | `All_AXS_Backend-main` |

**Status:** `[ ]` open · `[~]` in progress · `[x]` done

---

## Wave 1 — Phase A finish + independent P1 polish (parallel, no deps)

| ID | Title | Agent | Status |
|----|--------|--------|--------|
| AUDIT-A2 | Buyer refund request flow | `generalPurpose` | `[x]` |
| AUDIT-A3 | Organizer attendee CSV export | `generalPurpose` | `[x]` |
| AUDIT-A1-T | Coupon tests + spec/checklist cleanup | `generalPurpose` | `[x]` |
| POLISH-005 | Email verification gate policy | `generalPurpose` | `[x]` |
| POLISH-006 | Order confirmation & ticket UX copy | `generalPurpose` | `[~]` |
| POLISH-009 | Organizer event approved/rejected email | `generalPurpose` | `[x]` |
| POLISH-010 | Buyer order refund email | `generalPurpose` | `[~]` |
| POLISH-011 | Change-password confirmation email | `generalPurpose` | `[~]` |
| NOTIF-POLISH | Hub notification polish (dropdown read + slug→edit) | `generalPurpose` | `[x]` |

---

## Wave 2 — Ops + product breadth (parallel)

| ID | Title | Agent | Deps | Status |
|----|--------|--------|------|--------|
| AUDIT-B4 | Daraja B2C auto-payout disbursement | `generalPurpose` | — | `[x]` |
| AUDIT-C2 | Multi-currency hardening | `generalPurpose` | — | `[ ]` |
| AUDIT-C4 | Comp / hidden ticket links | `generalPurpose` | — | `[x]` |
| AUDIT-D2 | Featured events (`isFeatured` + admin toggle) | `generalPurpose` | — | `[x]` |
| POLISH-012 | Newsletter footer wire or remove | `generalPurpose` | — | `[x]` |
| POLISH-013 | Guest checkout / account sync messaging | `explore` → `generalPurpose` | — | `[x]` |
| POLISH-015 | Admin TODO slice (pick 15a–15d) | `generalPurpose` | — | `[ ]` |
| ADMIN-FU | Admin misc follow-ups (ReviewPanel dialog, auth broadcast) | `generalPurpose` | — | `[x]` |

---

## Wave 3 — Notification platform (sequential foundation)

| ID | Title | Agent | Deps | Status |
|----|--------|--------|------|--------|
| AUDIT-B1 | Unified notification dispatcher (EMAIL/SMS/WA/PUSH queue) | `generalPurpose` | — | `[x]` |
| AUDIT-B2 | SMS via Africa's Talking adapter | `generalPurpose` | B1 | `[x]` |
| AUDIT-B3 | WhatsApp ticket delivery | `generalPurpose` | B1 | `[x]` |

---

## Wave 4 — Experience & growth (parallel after Wave 3 for C1/D4)

**AUDIT-D1 notes (2026-05-22):** First installment via Paystack init shipped; plan total uses discounted `Order.amountCents`. Subsequent installments deferred — see `docs/INSTALLMENTS_FOLLOWUP.md` (charge authorization cron).

| ID | Title | Agent | Deps | Status |
|----|--------|--------|------|--------|
| AUDIT-C1 | Waitlist for sold-out tiers | `generalPurpose` | B1 recommended | `[x]` |
| AUDIT-C3 | Apple/Google Wallet passes | `ai-architect` → `generalPurpose` | 007 | `[~]` |
| AUDIT-D1 | Real installment checkout (Paystack) | `generalPurpose` | coupons done | `[x]` |
| AUDIT-D3 | Organizer analytics (funnel, conversion, refunds) | `generalPurpose` | — | `[ ]` |
| AUDIT-D4 | Organizer email blast to buyers | `generalPurpose` | B1 | `[x]` |
| AUDIT-D5 | Multi-user org team (invite + roles) | `generalPurpose` | — | `[x]` |

---

## Wave 5 — Quality & CI (parallel)

| ID | Title | Agent | Deps | Status |
|----|--------|--------|------|--------|
| POLISH-007 | Frontend PDF parity Web/API | `explore` → `generalPurpose` | 004 | `[ ]` |
| POLISH-008 | Cypress auth + email-trigger flows | `generalPurpose` | 003 | `[ ]` |
| POLISH-014 | CI email/PDF smoke (DRY_RUN) | `shell` | 004 | `[ ]` |
| POLISH-016 | Wallet passes spike doc | `ai-architect` | 002, 007 | `[x]` |
| POLISH-017 | WhatsApp spike (superseded by AUDIT-B3 if shipped) | `generalPurpose` | — | `[x]` |

---

## Task briefs (Wave 1)

### AUDIT-A2 — Buyer refund request flow

**Goal:** Buyer can request a refund; admin approves/denies; existing `OrderRefundService.refundPaidOrder` runs on approval.

**Scope:** `RefundRequest` entity + migration; `POST /orders/:id/refund-request`; admin list/approve/deny; Web buyer page + admin queue; audit log entries.

**Out of scope:** Partial refunds, buyer self-serve Paystack refund without admin.

**Acceptance:** Buyer submits reason → admin approves → order refunded via existing path; deny leaves order PAID.

---

### AUDIT-A3 — Organizer attendee CSV export

**Goal:** Organizer downloads door/sponsor CSV per event.

**Scope:** API `GET /organizer/events/:id/attendees/export` (or sales export); Web button on sales/event view; CSV columns: name, email, tier, order ref, check-in status if available.

**Acceptance:** Paid tickets for one event export as CSV; 403 for non-owner.

---

### AUDIT-A1-T — Coupon tests + docs

**Goal:** Close COUPONS_SPEC §12 steps 7–10.

**Scope:** Wire-check refund rollback in `OrderRefundService`; unit tests for `CouponsService`; Cypress `coupons-checkout.cy.ts` + organizer CRUD; update `COUPONS_SPEC.md` + `ORGANIZER_PRODUCT_CHECKLIST.md` to DONE.

---

### NOTIF-POLISH — Hub notifications

**Goal:** Standard inbox UX.

**Scope:** (1) On bell dropdown open, mark all visible notifications read OR call read-all (match product choice: mark-all-read). (2) Resolve `/e/{slug}` links to `/organizer/events/{id}/edit` when slug→event lookup succeeds.

**Reference:** `lib/notifications-navigation.ts`, `HubTopBar.tsx`.

---

## Prompt template

```text
Task ID: <ID>
Repos: All_AXS_Web-main + All_AXS_Backend-main (as needed)
Read: docs/SUBAGENT_MASTER_PLAN.md section <ID>
      docs/SUBAGENT_BACKLOG.md (if POLISH-*)
      docs/COUPONS_SPEC.md (if AUDIT-A1-T)

Implement only listed scope. No unrelated refactors.
When done: mark [x] in SUBAGENT_MASTER_PLAN.md (+ SUBAGENT_BACKLOG.md if applicable), list files changed, note blockers.
```

---

*Created 2026-05-22 — orchestrates audit Phase A–D + SUBAGENT_BACKLOG remaining items.*
