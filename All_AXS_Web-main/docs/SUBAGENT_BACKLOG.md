# Sub-agent backlog — post-email polish

Structured work items for parallel Cursor sub-agents. Each task is **independently assignable** when its dependencies are met.

**Repos**

| Alias | Path |
|--------|------|
| **Web** | `All_AXS_Web-main` (this repo) |
| **API** | `All_AXS_Backend-main` (sibling Nest API) |

**How to assign a sub-agent**

1. Copy one task block (ID through Acceptance criteria) into the Task tool prompt.
2. Set `subagent_type` from the **Agent** column.
3. Set `readonly: true` only for audit/docs tasks marked Read-only.
4. Mark the checkbox here when merged (`[x]`).

**Status key:** `[ ]` open · `[~]` in progress · `[x]` done

---

## P0 — Launch gate (do first)

### POLISH-001 — Staging env audit & doc update

| Field | Value |
|--------|--------|
| **Agent** | `deployment-expert` or `generalPurpose` |
| **Repos** | Web + API (read env examples only; no secrets in git) |
| **Depends on** | — |
| **Status** | `[x]` |

**Goal:** Confirm staging/production env vars are documented and consistent so emails, Paystack, and ticket links work outside localhost.

**Scope**

- Cross-check `docs/STAGING_CHECKLIST.md` against `.env.example` / README in Web and API.
- List required vars: `FRONTEND_URL`, `RESEND_*`, `PAYSTACK_*`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_USE_API_CHECKOUT`.
- Add a short “common misconfigurations” section if gaps found.

**Out of scope:** Changing Vercel/dashboard settings (document only).

**Acceptance criteria**

- [x] Checklist matches actual env var names in both repos.
- [x] Single “copy-paste” staging block for Web + API in doc or README pointer.
- [x] No secrets committed.

---

### POLISH-002 — Staging smoke test (Pay → email → scan → refund)

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` (use browser MCP if available) |
| **Repos** | Web + API |
| **Depends on** | POLISH-001 (env must be set on staging) |
| **Status** | `[x]` |

**Goal:** Execute `docs/STAGING_CHECKLIST.md` happy path on **staging** and record results.

**Scope**

1. Paid checkout (small tier).
2. Ticket email received (Resend log ID).
3. Open PDF attachment; QR resolves to `/v/...` on staging site.
4. Check-in once via organizer/admin scanner.
5. Full refund in admin; confirm tickets voided / inventory per product rules.

**Deliverable:** Append a **Smoke log** subsection to `STAGING_CHECKLIST.md` (template: date, order id, Resend id, pass/fail per step).

**Out of scope:** Fixing unrelated bugs (file follow-up tasks instead).

**Acceptance criteria**

- [x] All five steps attempted on staging (2026-05-16 run used Production Vercel URLs; see `STAGING_CHECKLIST.md` smoke log).
- [x] Failures documented with repro + suggested owner task ID (env/redeploy: POLISH-001; scan/`/v` deploy gap noted in smoke log).

---

### POLISH-003 — Resend verification UI (Web)

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web (+ API route already exists) |
| **Depends on** | — |
| **Status** | `[x]` |

**Goal:** Expose `POST /auth/resend-verification` in the Next.js app.

**Scope**

- API proxy route (match existing auth proxy pattern under `app/api/`).
- UI: link on login and/or dedicated `/verify-email` or “check your inbox” state with email input + “Resend”.
- Rate-limit UX (generic success message; no email enumeration).
- Match existing auth page styling.

**Reference:** API `All_AXS_Backend-main/src/auth/auth.controller.ts` → `resend-verification`.

**Out of scope:** Changing verification token TTL or email template.

**Acceptance criteria**

- [x] Unverified user can request resend from Web.
- [x] Resend hits API and triggers `sendVerificationEmail` in logs/Resend.
- [x] Copy matches forgot-password tone.

---

### POLISH-004 — Brand assets for ticket PDFs (no localhost dependency)

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | API (primary), Web (assets) |
| **Depends on** | — |
| **Status** | `[~]` |

**Goal:** PDF header logos load reliably when generating email PDFs on the API (not only when `FRONTEND_URL` serves `/brand/*`).

**Scope (pick one approach, document choice)**

- **A:** Bundle `logo-mark-white.png` (and any required marks) in API `assets/` and load locally in `ticket-pdf.service.ts`.
- **B:** `EMAIL_LOGO_URL` / `BRAND_ASSET_BASE_URL` env with CDN or production `FRONTEND_URL` fallback.
- Ensure Web `public/brand/` stays source of truth; sync or document copy step.

**Out of scope:** Redesigning PDF layout.

**Acceptance criteria**

- [x] `npm run smoke:ticket-email` produces PDF with logo on machine without Next dev server.
- [x] Document env vars in API `.env.example`.

---

## P1 — Buyer & auth polish

### POLISH-005 — Email verification gate policy

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web + API |
| **Depends on** | POLISH-003 (recommended) |
| **Status** | `[ ]` |

**Goal:** Decide and implement whether checkout requires `emailVerified`.

**Scope**

- Audit: register, Google sign-in, checkout, `POST /checkout/*`.
- If required: block checkout with clear CTA to resend verification (POLISH-003).
- If not required: document decision in `docs/STAGING_CHECKLIST.md` or auth README.

**Acceptance criteria**

- [ ] Behavior is consistent Web + API (no silent API 403 without UI).
- [ ] One paragraph product decision recorded in docs.

---

### POLISH-006 — Order confirmation & ticket UX copy

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web |
| **Depends on** | POLISH-002 (optional, for realistic copy) |
| **Status** | `[ ]` |

**Goal:** Post-purchase UI tells users to open **PDF attachment** and use My tickets / download PDF.

**Scope**

- Order success / confirmation components.
- My tickets list: resend email CTA if API supports it (`resendTickets`).
- Remove or soften misleading “demo only” copy when `NEXT_PUBLIC_USE_API_CHECKOUT=true`.

**Acceptance criteria**

- [ ] Paid API checkout path has accurate instructions (PDF, not inline QR in email).
- [ ] Resend tickets wired if endpoint exists and user owns order.

---

### POLISH-007 — Frontend PDF parity check

| Field | Value |
|--------|--------|
| **Agent** | `explore` then `generalPurpose` |
| **Repos** | Web + API |
| **Depends on** | POLISH-004 |
| **Status** | `[ ]` |

**Goal:** Download-from-browser PDF matches email PDF layout (no header/footer clash).

**Scope**

- Compare `Web/lib/ticket-pdf.ts` + layout helpers vs `API/src/.../ticket-pdf.layout.ts`.
- Port any drift (spacing, footer text-only, QR URL format `/v/{token}`).
- Optional: extract shared constants (dimensions, colors) to duplicated comment block if full shared package is out of scope.

**Acceptance criteria**

- [ ] Side-by-side PDF from email smoke script vs browser download for same ticket fields look equivalent.
- [ ] QR in both encodes same verify URL pattern.

---

### POLISH-008 — Cypress: auth + email-trigger flows

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web |
| **Depends on** | POLISH-003 |
| **Status** | `[ ]` |

**Goal:** E2E coverage for critical auth paths (mock API or test env).

**Scope**

- Forgot password → reset page loads with token param.
- Register → verify page / resend link visible.
- Optional: stub Resend or assert API mock called.

**Out of scope:** Real Resend delivery in CI.

**Acceptance criteria**

- [ ] New specs under `cypress/e2e/` pass in CI pattern used by repo.
- [ ] Document required env for e2e in README or `cypress.config`.

---

## P1 — Organizer & transactional email (new types)

### POLISH-009 — Organizer event approved/rejected email

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | API (email + hook), Web (optional preview) |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Email organizer when admin approves or rejects an event (in-app notification exists today).

**Scope**

- `EmailService`: `sendEventModerationEmail({ approved | rejected, reason?, event, organizer })`.
- Trigger from moderation approve/reject in `EventsService` or admin controller path.
- Reuse auth email HTML shell; link to `/organizer/events/[id]`.

**Acceptance criteria**

- [ ] Approve + reject both send (smoke script entry or admin test route).
- [ ] Subject/body include event title and reject reason when applicable.

---

### POLISH-010 — Buyer order refund email

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | API |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Email buyer when admin issues full (or partial) refund.

**Scope**

- Hook after successful Paystack refund + order status update.
- Include order ref, event name, amount, link to My tickets / support.

**Acceptance criteria**

- [ ] Refund smoke path documented; email in `smoke-all-emails` or dedicated script.
- [ ] No email on failed refund.

---

### POLISH-011 — Change-password confirmation email

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | API |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** When user changes password while logged in (not reset flow), send security notice email.

**Scope**

- Mirror `sendPasswordResetConfirmationEmail` styling.
- Hook `changePassword` / update password endpoint.
- “If this wasn’t you, contact support” + link to forgot password.

**Acceptance criteria**

- [ ] Email sent on successful password change from account settings.
- [ ] Not duplicated when reset flow already sends confirmation.

---

## P2 — Product cleanup & ops

### POLISH-012 — Newsletter footer: wire or remove

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web (+ API if list endpoint needed) |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Footer “Stay in the loop” is honest—either functional or removed.

**Scope**

- **Option A:** Resend Audiences / external form + env `RESEND_AUDIENCE_ID`.
- **Option B:** Remove form; static “Follow us” links only.

**Acceptance criteria**

- [ ] No fake success toast on submit.
- [ ] Privacy copy if storing emails.

---

### POLISH-013 — Guest checkout / account sync messaging

| Field | Value |
|--------|--------|
| **Agent** | `explore` → `generalPurpose` |
| **Repos** | Web + API |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Clarify or implement guest purchase → account ticket linking.

**Scope**

- Audit checkout guest vs signed-in; order `userId` assignment.
- Confirmation email + CTA: “Create account with this email to see tickets.”
- Implement only if product wants it; otherwise update copy only.

**Acceptance criteria**

- [ ] Documented behavior in checkout README or docs.
- [ ] No dead-end for guest who paid with email matching later registration (if implement linking).

---

### POLISH-014 — CI: email smoke in pipeline (optional)

| Field | Value |
|--------|--------|
| **Agent** | `shell` or `ci-investigator` |
| **Repos** | API |
| **Depends on** | POLISH-004 |
| **Status** | `[ ]` |

**Goal:** Non-interactive check that PDF generation and email HTML build do not throw.

**Scope**

- `npm run smoke:all-emails` with `DRY_RUN=1` or mock Resend in CI.
- Or unit test: `TicketPdfService` returns buffer; `EmailService` builds payload without send.

**Acceptance criteria**

- [ ] Job runs on PR without live Resend key.
- [ ] Document skip conditions.

---

### POLISH-015 — Admin backlog slice (pick one)

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | Web + API |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Complete **one** high-value item from `docs/ADMIN_TODO.md`.

**Suggested picks (choose one when assigning)**

| Slice | Summary |
|--------|---------|
| **15a** | `/admin/events/[id]/orders` list + click-through from revenue strip |
| **15b** | “Resync sold counts” action for ticket tiers |
| **15c** | Optimistic UI after Approve/Reject on event detail |
| **15d** | Organizer “admin edited your event” badge from audit log |

**Acceptance criteria**

- [ ] One slice shipped end-to-end.
- [ ] `ADMIN_TODO.md` updated with `[x]` for that slice.

---

## P2 — Future / large

### POLISH-016 — Apple Wallet / Google Wallet passes

| Field | Value |
|--------|--------|
| **Agent** | `ai-architect` or `generalPurpose` |
| **Repos** | API + Web |
| **Depends on** | POLISH-002, POLISH-007 |
| **Status** | `[ ]` |

**Goal:** Spike only—requirements, signing certs, pass structure, estimate.

**Deliverable:** `docs/WALLET_PASSES_SPIKE.md` (no implementation required in spike task).

---

### POLISH-017 — WhatsApp ticket delivery

| Field | Value |
|--------|--------|
| **Agent** | `generalPurpose` |
| **Repos** | API |
| **Depends on** | — |
| **Status** | `[ ]` |

**Goal:** Spike or implement Twilio/WhatsApp Business template for ticket link/PDF.

**Out of scope for v1 unless product mandates.

---

## Assignment matrix (quick reference)

| ID | Title | Agent | P | Deps |
|----|--------|--------|---|------|
| POLISH-001 | Staging env audit | deployment-expert | P0 | — |
| POLISH-002 | Staging smoke test | generalPurpose | P0 | 001 |
| POLISH-003 | Resend verification UI | generalPurpose | P0 | — |
| POLISH-004 | PDF brand assets on API | generalPurpose | P0 | — |
| POLISH-005 | Email verified gate | generalPurpose | P1 | 003 |
| POLISH-006 | Order/ticket UX copy | generalPurpose | P1 | 002 |
| POLISH-007 | PDF parity Web/API | explore → generalPurpose | P1 | 004 |
| POLISH-008 | Cypress auth E2E | generalPurpose | P1 | 003 |
| POLISH-009 | Organizer moderation email | generalPurpose | P1 | — |
| POLISH-010 | Refund email | generalPurpose | P1 | — |
| POLISH-011 | Change-password email | generalPurpose | P1 | — |
| POLISH-012 | Newsletter wire/remove | generalPurpose | P2 | — |
| POLISH-013 | Guest checkout messaging | explore → generalPurpose | P2 | — |
| POLISH-014 | CI email/PDF check | shell | P2 | 004 |
| POLISH-015 | Admin TODO slice | generalPurpose | P2 | — |
| POLISH-016 | Wallet passes spike | ai-architect | P2 | 002, 007 |
| POLISH-017 | WhatsApp spike | generalPurpose | P2 | — |

---

## Parallel run groups

Run these **in parallel** (no deps between them):

- **Wave A (P0):** 001, 003, 004
- **Wave B (after A env):** 002
- **Wave C (P1 product):** 005, 006, 007, 008, 009, 010, 011
- **Wave D (P2):** 012, 013, 014, 015 (one slice each)

---

## Sub-agent prompt template

```text
Task ID: POLISH-00X
Repo: All_AXS_Web-main (+ All_AXS_Backend-main if noted)
Read: docs/SUBAGENT_BACKLOG.md section POLISH-00X

Implement only the scope listed. Do not refactor unrelated code.
When done: update checkbox in SUBAGENT_BACKLOG.md, list files changed, and note any follow-up task IDs.
```

---

*Last updated: 2026-05-16 — transactional emails (verify, reset, reset confirm, welcome, ticket PDF) considered complete.*
