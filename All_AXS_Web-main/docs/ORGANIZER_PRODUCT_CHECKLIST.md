# Organizer product checklist (handoff for implementation agent)

**Positioning:** Premium summit–style events (tech, culture, life sciences, etc.) — All AXS is the **ticket seller**: trust, polished UX, clear money flow, strong day-of story.

**Repos:** This checklist references **`All_AXS_Web-main`** (Next) and **`All_AXS_Backend-main`** (Nest). Paths are indicative; verify with search when implementing.

**Status legend**

| Status | Meaning |
|--------|---------|
| **DONE** | Shipped in repo with reasonable UX wiring |
| **PARTIAL** | Exists but incomplete, stubbed, or missing edge flows |
| **GAP** | Not implemented (or unknown) — needs build |

---

## P0 — Must work for a credible “we sell tickets for summits” MVP

| # | Capability | Why it matters | Web (indicative) | API / proxy (indicative) | Status | Notes |
|---|------------|----------------|------------------|---------------------------|--------|-------|
| 1 | Sign in / session | Organizers are authenticated users | `/login`, `/register`, `middleware.ts` | `/auth/*` via `app/api/auth/*` | DONE | Hub at `/organizer/*` |
| 2 | Organizer onboarding (profile) | Trust + payout identity | `/organizer/onboarding`, `app/api/organizer/profile/route.ts` | `GET/POST /organizers/profile` | PARTIAL | Confirm edit path for existing profile; align copy with “summit seller” |
| 3 | Role: ORGANIZER | Gate APIs | promote flow `app/api/auth/promote-organizer/route.ts` | `POST /auth/promote-organizer-demo` (env-gated) | PARTIAL | JWT refresh after role change; document prod flags |
| 4 | Create event (draft) | Core inventory | `/organizer/events/new`, `POST /api/events` | `POST /events` | DONE | |
| 5 | Edit event (details, media, tiers) | Summit-grade listing | `/organizer/events/[id]/edit`, tabs under `components/organizer/event-editor/*` | `GET/PATCH /events/:id`, uploads | PARTIAL | Validate all tabs against API errors + loading |
| 6 | List **my** events (not public catalog) | Organizer clarity | `/organizer/events` uses `GET /api/events` | `GET /events` (Bearer, organizer inventory) | DONE | Web uses **only** authenticated `GET /api/events` → Nest `GET /events` (never `GET /events/public`). Response normalized for `{ events }`, `{ content }`, etc. (`lib/organizer-events-list.ts`). **Backend must** enforce JWT organizer scope on `GET /events`. |
| 7 | Submit for review → publish | Governance for premium events | `app/api/events/[id]/submit/route.ts`, admin UI | submit + admin approve/reject | PARTIAL | Cypress: `cypress/e2e/organizer-submit-admin-publish.cy.ts` (stubbed Next routes: submit → admin queue → approve). **Follow-up:** assert published event on `/events` / `GET /events/public` when API runs in CI. |
| 8 | Public event discovery | Buyers find summits | `/events`, `/e/[slug]` | public events API | PARTIAL | Env: `NEXT_PUBLIC_USE_DEMO_EVENTS` vs API |
| 9 | Checkout + paid order | Money path | `/events/[id]/checkout`, `NEXT_PUBLIC_USE_API_CHECKOUT` | `POST /checkout/demo` (demo), real gateway TBD | PARTIAL | Replace demo with production Paystack (or chosen PSP) |
| 10 | Attendee tickets + QR | Door story | `/tickets`, `lib/ticket-qr.ts` | `GET /tickets/me`, `GET /tickets/:id` | PARTIAL | HMAC verify path for scanners (product decision) |

---

## P1 — Expected for “high class” / finance-heavy organizers

| # | Capability | Web | API | Status | Notes |
|---|------------|-----|-----|--------|-------|
| 11 | Orders list (organizer view) | GAP | GAP | GAP | Filter by event, status, date; link to attendees |
| 12 | Attendees / guest list export | GAP | GAP | GAP | CSV for door + sponsor badges |
| 13 | Refunds / cancellations | GAP | GAP | GAP | Policy + Paystack reversal or manual workflow |
| 14 | Payout status + statements | GAP | GAP | GAP | Tie to `organizer_profiles` payout fields |
| 15 | Fee transparency (platform vs organizer) | GAP | GAP | GAP | Show in UI + contract copy |
| 16 | Comp / hidden ticket links | GAP | GAP | GAP | VIP lists, speaker codes |

---

## P2 — Summit-grade operations

| # | Capability | Web | API | Status | Notes |
|---|------------|-----|-----|--------|-------|
| 17 | Check-in app (scan QR) | GAP | GAP | GAP | Staff role, offline tolerance later |
| 18 | Email blast to buyers | GAP | GAP | GAP | Or integrate SendGrid/Marketplace |
| 19 | Multi-user org team | GAP | GAP | GAP | Invite co-organizer, roles |
| 20 | Sponsor / exhibitor modules | GAP | GAP | GAP | Often separate from core ticketing |
| 21 | Agenda / multi-track | GAP | GAP | GAP | CMS-style or structured JSON |

---

## P3 — Growth & differentiation

| # | Capability | Status | Notes |
|---|------------|--------|-------|
| 22 | SEO + OG per event | PARTIAL | `NEXT_PUBLIC_SITE_URL`, event pages |
| 23 | Embeddable widget / white-label | GAP | |
| 24 | Analytics (sales funnel, traffic) | GAP | |
| 25 | Waitlist + release waves | GAP | High-demand summits |

---

## API semantics: organizer `GET /events` vs public catalog (resolved for this repo)

| Surface | Next / web entry | Upstream (Nest) | Auth | Purpose |
|---------|------------------|-----------------|------|---------|
| Public browse + SEO | `fetchPublicEvents` in `lib/utils/api-server.ts` | **`GET /events/public`** (optional query params) | None | Published catalog only; used by `/events`, sitemap when API mode is on. |
| Organizer “My events” | Browser `GET /api/events` (`app/api/events/route.ts`) | **`GET /events`** | **Bearer** from `accessToken` cookie | Intended inventory for the authenticated organizer. Distinct URL from public catalog. |

`NEXT_PUBLIC_USE_DEMO_EVENTS` affects **only** the public catalog path above, not `/organizer/events`.

---

## Cross-cutting engineering tasks (any agent)

1. ~~**Verify `GET /events` semantics** for organizer list vs public catalog — document in this file when resolved.~~ **Done** — see table in previous section.  
2. **E2E script (manual or Cypress):** seed demo → organizer login → create event → add tier → submit → admin approve → public URL → checkout → ticket visible. **Progress:** `cypress/e2e/organizer-submit-admin-publish.cy.ts` covers submit → admin approve (stubbed Next API); `cypress/e2e/event-editor.cy.ts` covers list/create/edit including wrapped `GET /api/events` payloads. **Still open:** full stack seed + `/events` catalog + checkout + ticket.  
3. **Env matrix:** document required vars for web + API (`docs/VERCEL.md`, backend `docs/DEMO_ROLES_AND_CHECKOUT.md`).  
4. **Error surfaces:** every organizer `axios` call should map API errors to human copy (network, 403, validation). **Progress:** `/organizer/events` list (`app/organizer/events/page.tsx`) maps network / 401 / 403 / 4xx.  

---

## Suggested order of execution for the next agent

1. Close **P0 #6** (my-events accuracy) and **P0 #7** (submit/publish E2E).  
2. Production **checkout** (replace demo) if demo is not acceptable for stakeholders.  
3. **P1 #11–12** (orders + export) — highest ROI for summit producers.  
4. **P1 #13–15** money trust.  
5. **P2 #17** check-in when door story is required for launch.

When an item moves from GAP → DONE, update the **Status** column and add a one-line **PR / commit** reference if helpful.
