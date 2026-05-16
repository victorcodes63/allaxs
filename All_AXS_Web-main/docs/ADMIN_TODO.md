# Admin Workspace — Open Items

A running TODO of follow-ups that surfaced while building out the admin
dashboard, moderation queue, and platform-wide event browsing. Keep this in
sync as items are picked up. Sections are roughly ordered by priority.

---

## 1. Admin event editor — shipped

Admins now have a full editor at `/admin/events/[id]/edit` that reuses the
same tabbed UI as `/organizer/events/[id]/edit`. The "Edit as admin" CTA on
`/admin/events/[id]` opens the editor regardless of event status.

- [x] Product policy decided: **admins can edit any event in any status**.
      Organisers keep their existing `DRAFT | PENDING_REVIEW | REJECTED`
      gate (plus price-only edits on PUBLISHED ticket tiers).
- [x] Admin editor route `/admin/events/[id]/edit` reuses
      `EventDetailsTab` / `EventMediaTab` / `EventTicketTiersTab` /
      `EventSalesTab` via a new `canEditOverride` prop that unlocks the
      form and hides the "Submit for Review" CTA (irrelevant for admin
      overrides).
- [x] Backend: `PATCH /events/:id`, `POST /events/:id/banner/commit`,
      and the `/ticket-types/*` endpoints now accept `Role.ADMIN`. The
      `EventsService.ensureOwnership` helper takes a `userRoles` argument
      and skips the ownership check when the actor has the admin role.
- [x] Audit logging: admin mutations write to `admin_audit_logs` with
      distinct actions (`ADMIN_UPDATE_EVENT`,
      `ADMIN_UPDATE_EVENT_BANNER`, `ADMIN_SUBMIT_EVENT`,
      `ADMIN_CREATE_TICKET_TYPE`, `ADMIN_UPDATE_TICKET_TYPE`,
      `ADMIN_DELETE_TICKET_TYPE`). The metadata payload captures the
      organiser's user id + the raw DTO so a reviewer can see exactly
      what was changed.

Follow-ups (small):

- [ ] Surface admin override badge in the `/organizer/events/[id]/edit`
      page when the audit log shows recent admin edits, so the organiser
      isn't blind-sided by changes to their own event.

## 2. Admin event detail page enhancements

`/admin/events/[id]` now renders status, organiser, dates, venue, ticket
tiers (with sold/remaining + sales window), a revenue summary, moderation
history, and inline Approve / Reject controls. Follow-ups:

- [x] List ticket tiers inline (name, price, sold/total, sales window). Backed
      by the existing `/admin/events/:id` payload.
- [x] Show an order/revenue strip for the event (count of paid orders, gross,
      refunds). New endpoint: `GET /admin/events/:id/orders-summary`.
- [x] Surface moderation history using `admin_audit_logs` filtered by
      `resourceId`. New endpoint: `GET /admin/events/:id/audit`.
- [x] Replace the inline `ReviewPanel` modal trigger with a dedicated
      "Approve / Reject" pair of buttons that operate from this page.
      Implemented via `components/admin/EventReviewActions.tsx` with themed
      confirm + reject-reason dialogs.
- [ ] Wire the revenue strip into a click-through to a future
      `/admin/events/[id]/orders` view once Section 4 lands.
- [ ] Add a "Resync sold counts" action for tiers (useful when ticket totals
      drift from order rows).
- [ ] Optimistic update of `audit` + status chip immediately after Approve /
      Reject (currently relies on a full `load()` refetch).

## 3. Moderation queue polish

`/admin/moderation` is now visually matched with `/admin/events` and ships
a reusable selection primitive (`lib/hooks/use-selection.ts`) plus
bulk-approve / bulk-reject confirm dialogs.

- [x] Replace the table layout with a card list to match `/admin/events`
      for visual consistency. Cards show banner, status chip, type chip,
      organiser email, sales window, tier count, and any rejection
      reason on file.
- [x] Add result count + sticky filter bar (top-aligned, backdrop-blurred,
      mirrors `/admin/events`).
- [x] Persist `status` and `search` in the URL so the queue is shareable
      (links from `/admin/events`' "Review" action now pre-populate
      search + status).
- [x] Bulk-approve / bulk-reject when multiple items are selected. New
      `lib/hooks/use-selection.ts` is the shared selection primitive
      (auto-prunes ids that disappear after a refetch). Bulk reject
      accepts a shared optional reason. Approve / Reject endpoints are
      called via `Promise.allSettled` and the summary banner reports
      success + failure counts.
- [x] Inline single-row Approve / Reject buttons on each pending card so
      admins no longer have to open the modal for the common case.
      `Details` still opens the legacy `ReviewPanel` for the deeper
      inspect view.

### Follow-ups

- [ ] Migrate `ReviewPanel`'s native `confirm()` to one of the themed
      dialogs we now use on the queue (Section 8 follow-up).
- [ ] Server-side bulk endpoints (`POST /admin/events/bulk-approve`,
      `bulk-reject`) once the audit log volume justifies it. Today
      `Promise.allSettled` over the existing single-row endpoint is
      cheap because each call only carries a JWT.
- [ ] Reuse `useSelection` on `/admin/orders` for the planned bulk-refund
      flow (Section 4 follow-up).

## 4. Admin orders & refunds UI

`/admin/orders` now lists every order on the platform with filters, search,
date range, pagination, and an inline refund dialog backed by the existing
audit-logged endpoint. Overview tiles deep-link into the filtered view.

- [x] New `/admin/orders` route with filters (status, event, organiser,
      date range), search by reference/email, and pagination. Backed by
      new endpoint `GET /admin/orders` (offset-based, max 100 per page).
- [x] Inline drawer for refund — collect reason (optional), hits
      `POST /admin/orders/:id/refund`. Implemented via
      `components/admin/RefundOrderDialog.tsx`; refunds are always the full
      order amount (Paystack full refund only).
- [x] Surface refund totals on the admin overview dashboard alongside paid
      gross/net. Overview payload extended with `orders.refunded.count` +
      `grossCents`; sales card now has a 4th tile for Refunded gross and
      status counters are clickable.
- [x] Wire the revenue strip on `/admin/events/[id]` to deep-link into
      `/admin/orders?eventId=...&status=...`.
- [x] Trigger provider-side refunds (Paystack) when the admin issues a
      refund — `OrderRefundService` calls `POST https://api.paystack.co/refund`
      before voiding tickets and restoring tier inventory. Demo orders
      (`reference` prefix `demo_`) skip Paystack. Refunds are full order only;
      admin UI matches (no partial amounts).
- [ ] Allow undoing an accidental refund (revert to PAID) within a short
      grace period.
- [x] Bulk-refund selection on the orders list. Backed by
      `lib/hooks/use-selection.ts` (added in Section 3) and
      `components/admin/BulkRefundDialog.tsx`. Hard-capped at
      `BULK_REFUND_MAX = 20` per batch (refunds are money operations — keep
      the blast radius tractable). Always issues full refunds per row; the
      per-row dialog is for single-order full refunds with an optional reason.
      Mixed-currency selections show
      per-currency totals in the confirm step. Result banner reports
      succeeded + failed counts and the list reloads.

### Pre-existing schema cleanup (surfaced while building this)

While building `GET /admin/orders` we discovered that several tables carried
duplicate physical columns for the same foreign key — `orders` had both
`eventId` + `event_id` and `userId` + `user_id`; `order_items` had
`orderId` + `order_id` and `ticketTypeId` + `ticket_type_id`;
`organizer_profiles` had both `userId` and `user_id`; plus the same pattern
on `tickets`, `payments`, `payment_plans`, `payment_installments`,
`coupons`, `checkins`, and `ticket_types`. The seed populated the camelCase
columns while TypeORM's `@JoinColumn` metadata pointed at the empty
snake_case ones, so admin queries needed explicit camelCase workarounds.

- [x] Migration `UnifyForeignKeyColumns1762950000000` backfills every
      snake_case column from its camelCase twin, drops the camelCase
      duplicates (including any single-column / composite / unique
      indexes that referenced them), promotes the snake_case column to
      NOT NULL where the entity demands it, and recreates stable
      `IDX_<table>_<column>` indexes plus the composite
      `IDX_ticket_types_event_name_unique` and
      `IDX_payment_installments_sequence` indexes on the canonical
      columns. A defensive pre-cleanup step deletes (or NULLs, for
      nullable FKs) any rows whose camelCase FK no longer references a
      live parent row, so the migration is safe to re-run on dirty
      environments. Local Neon run cleaned up 1 orphan `order_items`
      row and 1 orphan `tickets` row that referenced a deleted
      ticket-type.
- [x] Entity `@Column` declarations on `Order`, `OrderItem`, `Ticket`,
      `Payment`, `PaymentPlan`, `PaymentInstallment`, `CheckIn`,
      `Coupon`, `TicketType`, and `OrganizerProfile` now use
      `@Column({ name: 'snake_case' })` so each property maps to a
      single physical column.
- [x] The seed script already worked off entity property names — no
      changes required after the entity rename.
- [x] `listOrders` and `getUserDetail` in `AdminController` were
      simplified to standard `innerJoinAndSelect('orders.event', 'event')`
      and the raw `SELECT "orderId" / "eventId" FROM ...` aggregates
      were rewritten against the canonical snake_case columns.

Follow-ups:

- [x] Replicated against the live Neon DB (the project's `DATABASE_URL`
      already points at the live cluster; `migration:run` reported
      `UnifyForeignKeyColumns1762950000000` as the last executed
      migration on the live DB). Production admin endpoints
      (`/admin/overview`, `/admin/orders`, `/admin/users/:id`) smoke-
      tested clean.
- [ ] When the test database is rebuilt from scratch, confirm the
      `CreateEmailVerificationsAndPasswordResetsTables` /
      `CreateRefreshTokensTable` migrations (which deliberately use
      camelCase `userId` columns) still work in isolation — those
      tables are NOT covered by the unification because their entities
      don't have the duplicate `@Column` + `@JoinColumn` pattern, but
      it's worth a quick verify.

## 5. Admin user management UI

`/admin/users` now lists every account on the platform with role/status
chips, free-text search, role + status pill filters, pagination, role
management, suspend/reactivate, and audit history — all backed by new
admin-scoped endpoints.

- [x] `/admin/users` list with role chips, search, and a "Manage roles"
      sheet that posts to `PATCH /admin/users/:id/roles`. Implemented via
      `components/admin/ManageUserRolesDialog.tsx`. Backed by new
      `GET /admin/users` (search + role + status filters, offset pagination).
- [x] Show the audit trail for role changes per user. New endpoint
      `GET /admin/users/:id/audit` + `components/admin/UserAuditDialog.tsx`.
      Renders both role updates and status changes with old/new values.
- [x] Add a quick "Promote to admin" / "Suspend account" row action behind a
      themed confirm dialog. Implemented via
      `components/admin/UserActionConfirmDialog.tsx`. Suspend uses new
      `PATCH /admin/users/:id/status` (writes audit log). Self-suspend and
      removing your own `ADMIN` role are blocked client- and server-side.

### Follow-ups

- [x] Enforce `user.status === 'ACTIVE'` in the auth pipeline so suspending
      a user actually revokes their active session. Implemented in
      `JwtStrategy.validate` (re-reads the user on every request and emits
      a `accountSuspended` code) and in `AuthService.login` /
      `AuthService.refreshTokens`. Suspending now also revokes every active
      refresh-token session via the new `AuthService.forceSignOutUser`
      helper, and the count is recorded in the audit log.
- [x] Surface a "Force sign-out" / token revocation control alongside
      suspend. New endpoint: `POST /admin/users/:id/force-logout` (audit
      action `FORCE_USER_LOGOUT`). Admin UI exposes a "Force sign-out"
      row action on every ACTIVE user via
      `UserActionConfirmDialog`.
- [x] Add a per-user detail page (`/admin/users/[id]`) with their hosted
      events, orders placed, and full audit trail — useful for support
      triage. Backed by new `GET /admin/users/:id` (plus Next proxy
      `/api/admin/users/[id]`). The page shows account summary, role/status
      actions, organizer profile, latest hosted events, latest orders, and
      audit timeline. `/admin/users` cards now expose a primary "Details"
      action.
- [x] Show whether a user already has an organiser profile and link through
      to the relevant hosted events from the detail page. Implemented with
      explicit `organizer_profiles.userId` lookups while the schema
      duplication remains; Section 4 cleanup can simplify this later.
- [ ] Optional follow-up: bump the access-token lifetime down (currently 15
      minutes) or have `AuthService.validateUser` skip a tiny in-memory
      cache so existing access tokens immediately reject suspended users.
      Today JwtStrategy already re-queries on every request, so the only
      gap is the (unlikely) case of an admin who suspends a user mid-flight
      — that user's already-in-flight request will still complete because
      validation has already happened.

## 6. Admin overview dashboard polish

The admin overview now refreshes automatically while the tab is active,
deep-links activity rows to their relevant admin views, and visualises recent
event submissions in a compact 14-day chart.

- [x] Auto-refresh the overview every 30 seconds when the tab is focused,
      while keeping the manual `Refresh` button for explicit reloads.
- [x] Make the "Recent admin activity" list link each row to the relevant
      resource (`/admin/events/:id` for events, `/admin/users?search=...` for
      user role/status actions, `/admin/orders?search=...` for order refunds).
      `GET /admin/users` and `GET /admin/orders` now search by id as well as
      their existing fields so these links resolve.
- [x] Add a small chart of submissions over time (last 14 days). Backed by
      `events.submissionTrend` on `GET /admin/overview`. The chart now uses
      a real `events.submittedAt` column (DRAFT → PENDING_REVIEW
      transition) with a `COALESCE(submitted_at, createdAt)` fallback for
      historic backfilled rows.

### Follow-ups — shipped

- [x] Real `submittedAt` column on `events`. Migration
      `AddEventSubmittedAt1762960000000` adds `submitted_at timestamptz`
      and backfills it from `createdAt` for every non-draft event.
      `EventsService.submitForReview` now stamps `submittedAt = new Date()`
      on every DRAFT/REJECTED → PENDING_REVIEW transition (re-submissions
      after a rejection intentionally overwrite the timestamp; "most
      recent submission" is more useful for the moderation queue than
      "first ever").
- [x] Pending-review queue on `/admin/overview` orders by
      `COALESCE(submitted_at, createdAt)` ASC so the events that have
      been waiting longest float to the top, instead of the events that
      were drafted longest ago.
- [x] Paid + refunded sparklines (14-day daily counts) on the
      `/admin/overview` Sales card. `GET /admin/overview` now returns
      `orders.paidTrend` and `orders.refundedTrend` arrays
      (`{ date, count, grossCents }`). Rendered as inline SVG via a tiny
      `Sparkline` component co-located with the dashboard. Tones:
      `emerald` for paid, `red` for refunded.

## 7. Pre-existing TypeScript noise — resolved

`npx tsc --noEmit` and `next build` are both currently clean. The
`/notifications` errors that used to appear in
`.next/dev/types/validator.ts` were stale dev-only artifacts that cleared
on the next full rebuild and haven't returned.

- [x] Verified `npx tsc --noEmit` reports zero errors after the
      Section 1–6 work.
- [x] Verified `npx next build` succeeds and the generated validator
      types correctly recognise `/notifications` as a valid app route.

## 8. Misc cleanup

- [x] `app/admin/moderation/page.tsx` now uses the same pill filter set as
      `/admin/events` (replaced the legacy `<select>`). Search bar lives in
      a sticky top-aligned bar with a result-count chip in the header.
- [ ] `ReviewPanel` confirm dialog uses the native `confirm()` — replace with
      a themed dialog so the dark hub stays consistent across browsers.
- [x] Add `/admin/orders` to the `AdminShell` sidebar and page-title helper.
- [x] Add `/admin/orders` to `HubTopBar` admin quick links.
- [x] Add `/admin/users` to `AdminShell` sidebar, page-title helper, and
      `HubTopBar` admin quick links. Admin overview "Community" card links
      through to filtered `/admin/users` views per role.
- [x] Cypress: admin sign-in → moderation queue → approve a pending event.
      Covered by `cypress/e2e/admin-user-management.cy.ts` ("approves a
      pending event from the moderation queue") in addition to the
      existing `cypress/e2e/organizer-submit-admin-publish.cy.ts` which
      drives the same flow from the organiser side.
- [x] Cypress: admin user management — suspend + reactivate + force
      sign-out, with payload assertions on the PATCH /status and
      force-logout POST. Covered by
      `cypress/e2e/admin-user-management.cy.ts` ("suspends and then
      reactivates an attendee" and "opens the user detail page and
      force-logs-out the user").
- [ ] Cypress: end-to-end role-change audit history check (promote
      attendee → admin, then suspend and reactivate, verify all four
      entries land in the user audit dialog).

## 9. Shared auth foundation

The previous `lib/auth.ts` exposed `useAuth()` as a component-local hook,
so every consumer (`AppChrome`, `SiteHeader`, every layout) ran its own
`/api/auth/me` fetch. That caused subtle chrome bugs — most recently the
marketing `SiteHeader` was rendering on top of the admin shell because
`AppChrome`'s `useAuth` instance lagged the admin layout's. Resolved by
hoisting auth state into a single `<AuthProvider>` at the root.

- [x] Add `lib/auth-context.tsx` with `AuthProvider` + a shared `useAuth`
      hook (still returns `{ user, loading }` plus new `refresh` /
      `setUser` helpers). `lib/auth.ts` is now a thin re-export so none of
      the 14 existing call sites needed to change.
- [x] Mount `<AuthProvider>` in `app/layout.tsx` (just inside `<body>`)
      so every consumer reads the same state.
- [x] Wire login / register to `refresh()` after a successful response
      so the freshly-signed-in user is in the context before navigation.
- [x] Wire all four logout call sites (`LogoutButton`, `SiteHeader`,
      `LoggedInBrowseChrome`, `HubAppShell`) to call `setUser(null)` so
      the chrome flips to signed-out state immediately without waiting
      for a context refetch.
- [ ] Consider broadcasting auth changes across tabs via `storage`
      events or `BroadcastChannel` so signing out in one tab also clears
      the shared context in any others.
- [ ] Add a Cypress regression: navigate `/login` → admin email → submit
      → land on `/admin` with the admin shell visible, no
      marketing-header flash, even on a slow `/api/auth/me`.

---

_Last updated: 2026-05-11 — Sections 1, 2, 3, 4, 5, 6 (overview polish),
7 (typed-routes) and 8 (Cypress admin coverage) are all checked in.
Highlights:_

- _Section 1 (admin event editor): `/admin/events/[id]/edit` ships with
  full `canEditOverride` reuse of the organiser editor; backend
  endpoints accept `Role.ADMIN`; every mutation is audit-logged with
  `ADMIN_*` actions._
- _Section 6 follow-ups: new `events.submitted_at` column (migration
  `AddEventSubmittedAt1762960000000`), real submission trend, and inline
  SVG sparklines for paid/refunded daily counts on `/admin/overview`._
- _Section 7: `tsc --noEmit` + `next build` are both clean; the stale
  `/notifications` validator errors are gone._
- _Section 8 / Cypress: `cypress/e2e/admin-user-management.cy.ts`
  covers approve-from-moderation, suspend/reactivate, and force-logout.
  Pair with the pre-existing
  `cypress/e2e/organizer-submit-admin-publish.cy.ts`._
- _Live-DB replication: project `DATABASE_URL` already targets Neon, so
  the `UnifyForeignKeyColumns1762950000000` +
  `AddEventSubmittedAt1762960000000` migrations are applied against the
  live database._

_Next recommended stops (small follow-ups only): organiser-visible
"recent admin edits" banner on `/organizer/events/[id]/edit`; replace
`ReviewPanel` `confirm()` with a themed dialog; broadcast auth changes
across tabs; extend Cypress with a role-change audit history regression._
