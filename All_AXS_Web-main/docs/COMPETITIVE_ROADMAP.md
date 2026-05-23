# All AXS Competitive Roadmap vs HustleSasa

**Created:** May 23, 2026  
**Positioning target:** Premium summit/conference ticketing for Africa — with selective parity on HustleSasa’s growth and payments UX.  
**Repos:** `All_AXS_Web-main` (Next.js) + `All_AXS_Backend-main` (NestJS)

---

## How to read this doc

| Column | Meaning |
|--------|---------|
| **Effort** | Engineering weeks (1 dev). `S` = 1–2w, `M` = 3–5w, `L` = 6–10w, `XL` = 10w+ |
| **Codebase** | What already exists — reduces net-new work |
| **Hustle parity** | How close this gets you to HustleSasa on that axis |

**Effort assumes:** existing team knows both repos; no mobile native specialists for PWA-only items.

---

## Strategic lanes (pick both, weight differently)

```text
Lane A — Summit OS (differentiate)     Admin moderation, audit, comp links, waitlist,
                                       wallet passes, enterprise door ops, fee ledger

Lane B — Hustle parity (compete)       Self-serve payouts, STK-first checkout, branded
                                       stores, marketplace discovery, mobile scan, CRM
```

**Recommendation:** Ship **Phase 0 + Phase 1** before broad commerce (merch store). That closes the trust and money-out gaps that lose organizers today.

---

## Phase 0 — Production gate (Weeks 1–4)

*Goal: Pay → email → scan → refund is green on staging/production. Without this, nothing else matters.*

| # | Initiative | Effort | Codebase starting point | Deliverable | Hustle parity |
|---|------------|--------|-------------------------|-------------|---------------|
| 0.1 | **Staging/prod smoke pass** | S | Routes exist: `/v/[token]`, `/organizer/tickets/scan`, `/admin/scan`, Paystack webhooks | Fill smoke log in `docs/STAGING_CHECKLIST.md`; fix deploy/env gaps | Baseline reliability |
| 0.2 | **Env hardening** | S | `scripts/validate-production-env.mjs`, `lib/public-events-mode.ts` | Web: `NEXT_PUBLIC_USE_DEMO_EVENTS=false`, API URLs aligned; API: `FRONTEND_URL`, `RESEND_*`, Paystack webhook | — |
| 0.3 | **Legal & trust pages** | S | Footer exists; policies on roadmap | `/terms`, `/privacy`, `/refund-policy`, `/payout-policy` + checkout acknowledgements | Matches Hustle support KB |
| 0.4 | **Organizer-facing error polish** | S | Partial in `app/organizer/events/page.tsx` | Map API errors → human copy on checkout, onboarding, scan | Support load ↓ |
| 0.5 | **E2E CI gate** | M | Cypress: 20+ specs; live API specs need `ENABLE_TEST_ROUTES` | CI job: lint + typecheck + build + `cypress:run` (stubbed + live against test API) | Regression safety |

**Phase 0 exit criteria:** One real Paystack test order on staging → email received → QR scan succeeds → admin refund succeeds. Documented in smoke log.

**Total Phase 0:** ~4–6 dev-weeks (can parallelize 0.1–0.4).

---

## Phase 1 — Organizer trust & money (Months 1–3)

*Goal: An organizer can launch, sell, get paid, and run the door without All AXS ops in the loop.*

| # | Initiative | Effort | Codebase starting point | Work required | Hustle parity |
|---|------------|--------|-------------------------|---------------|---------------|
| 1.1 | **Self-serve organizer withdrawals** | L | Admin batches: `/admin/payouts`, `admin-payout-batches.controller.ts`; organizer ledger: `/organizer/earnings`; Daraja B2C: `DarajaB2cService` | Add `POST /organizers/payouts/request`, min threshold, KYC flags on profile, Paystack Transfer recipient OR Daraja B2C self-serve; Web: “Withdraw” on earnings page; optional admin auto-approve rules | **Critical** — Hustle’s “Withdrawal & Verification” |
| 1.2 | **M-Pesa-first checkout UX** | M | Paystack init: `checkout.controller.ts`, web proxies; M-Pesa via Paystack hosted page today | Option A (faster): Paystack init with M-Pesa as default channel + inline copy/STK instructions. Option B (deeper): Daraja STK on `POST /checkout/mpesa/stk` + webhook, parallel to Paystack | **Critical** — Hustle’s primary buyer UX |
| 1.3 | **Volunteer scanner in-product** | M | Backend: `scanner-session.guard.ts`, `POST /scan/validate`; Web mgmt: `EventScannerTab`, `/organizer/tickets/scan`; URLs point to `SCANNER_APP_URL` | Add `/s/[token]` route (mobile PWA): camera QR scan, scan result UI, session expiry. Reuse `TicketScanPanel` patterns. Drop external `localhost:3001` dependency | **High** — Hustle in-app check-in |
| 1.4 | **Branded organizer pages** | M | Public events: `/e/[slug]`; organizer profile in DB | Subdomain or path store: `{slug}.axs.africa` or `/store/[slug]` with theme (logo, colors, bio, event list). DNS + middleware routing | **High** — `{name}.hustlesasa.shop` |
| 1.5 | **Installments 2..N automation** | M | D1 shipped: `docs/INSTALLMENTS_FOLLOWUP.md`, `PaymentPlansService`, checkout toggle in `CheckoutExperience.tsx` | Save Paystack `authorization_code`; cron charge due installments; ticket status badge “Partial payment” / “Paid in full” | Medium — both platforms touch installments |
| 1.6 | **Complimentary tickets UX** | S | Comp links: `/e/[slug]/comp/[token]`, hidden tiers | Organizer UI: “Send comp” → pick tier, quantity, email; mirrors Hustle “Sending complimentary ticket” | Medium |

**Phase 1 exit criteria:** Organizer signs up → event published → buyer pays via M-Pesa path → tickets emailed → volunteer scans via `/s/{token}` → organizer requests withdrawal → funds arrive (test mode).

**Total Phase 1:** ~14–20 dev-weeks (1.1 and 1.3 are the longest poles).

---

## Phase 2 — Growth & discovery (Months 3–6)

*Goal: Help organizers sell more tickets, not just process them.*

| # | Initiative | Effort | Codebase starting point | Work required | Hustle parity |
|---|------------|--------|-------------------------|---------------|---------------|
| 2.1 | **Marketplace discovery** | M | `/events` with filters; homepage featured rail (`isFeatured`) | Category taxonomy (Concerts, Conferences, etc.), city/country filters, SEO landing pages, “Trending” / “This week” rails; submit events to sitemap | **High** — hustle.events |
| 2.2 | **Affiliate / referral program** | L | Coupons per-event (not affiliate) | Affiliate codes linked to user/event; commission %; affiliate dashboard; payout via ledger | **High** — Hustle affiliate v3 |
| 2.3 | **Customer CRM** | M | Attendee CSV export; order list in `OrganizerSalesView` | `/organizer/customers`: search buyers, order history, tags, “email segment” → reuse announcement blast | **High** — Hustle Customers tab |
| 2.4 | **Deeper event insights** | M | `OrganizerAnalyticsSection`: 14-day chart, conversion, refund rate | Per-event Insights tab: date range, revenue by tier, traffic sources (UTM), scan rate, refund rate; export CSV | Medium |
| 2.5 | **Social share & embed** | S | OG metadata on `/e/[slug]` | Share buttons (WhatsApp, X, copy link); optional embed widget `script` for organizer sites | Medium |
| 2.6 | **Bulk SMS to attendees** | M | Email blast: `EventAnnouncementBlast`; Twilio for WhatsApp tickets | Africa’s Talking / Twilio SMS; opt-in, cost preview, templates (reminder, venue change) | Medium |

**Phase 2 exit criteria:** Organizer shares affiliate link → sale attributed → sees buyer in CRM → sends SMS reminder → event appears in categorized marketplace.

**Total Phase 2:** ~12–18 dev-weeks.

---

## Phase 3 — Mobile & multi-market (Months 6–9)

*Goal: Meet buyers and merchants on the device they actually use.*

| # | Initiative | Effort | Codebase starting point | Work required | Hustle parity |
|---|------------|--------|-------------------------|---------------|---------------|
| 3.1 | **Buyer PWA / native shell** | L | `/tickets`, wallet pass proxies | “Add to home screen” PWA with push (optional); or React Native shell: my tickets, QR, order history | **Critical** — Hustle iOS/Android |
| 3.2 | **Merchant mobile app (MVP)** | XL | Web organizer dashboard is full-featured | RN/Flutter MVP: create event, view sales, scan QR, withdraw; sync with existing API | **Critical** |
| 3.3 | **Multi-country payments** | L | Paystack Kenya-focused; `PaymentGateway.PAYSTACK` only | Ghana/TZ/RW: Flutterwave or regional PSP adapters; country selector at checkout; currency per event | **High** — 6-country claim |
| 3.4 | **Offline-tolerant scanning** | M | Online-only scan today | Service worker queue: scan offline → sync on reconnect; conflict rules for duplicate check-in | Medium |

**Phase 3 exit criteria:** Organizer creates event on phone; buyer in GH completes checkout; door staff scans offline briefly.

**Total Phase 3:** ~20–30 dev-weeks (native apps dominate; consider PWA-first to defer XL).

---

## Phase 4 — Creator commerce (Months 9–12, optional)

*Goal: Parity with HustleSasa’s “beyond tickets” storefront. Only pursue if target customers are festivals/concerts, not B2B summits.*

| # | Initiative | Effort | Codebase starting point | Work required | Hustle parity |
|---|------------|--------|-------------------------|---------------|---------------|
| 4.1 | **Merch & add-ons at checkout** | L | Tickets-only cart in `CheckoutExperience.tsx` | Product entity, inventory, cart lines (ticket + merch), combined Paystack charge | **High** |
| 4.2 | **Digital products** | M | — | Upload + deliver files post-payment (music, art PDFs) | Medium |
| 4.3 | **F&B pre-orders** | M | — | Per-event menu, pickup windows, linked to ticket order | Medium |
| 4.4 | **Delivery settings** | M | — | Shipping zones, fees for physical merch | Low for summits |

**Recommendation:** Defer Phase 4 unless ≥30% of pipeline asks for merch/F&B. Summits rarely need a full Shopify layer.

---

## Phase 5 — Enterprise differentiation (Ongoing, Lane A)

*Goal: Win deals HustleSasa cannot — corporate summits, governance-heavy producers.*

| # | Initiative | Effort | Codebase starting point | Why it wins |
|---|------------|--------|-------------------------|-------------|
| 5.1 | **White-glove onboarding tier** | S | Admin moderation exists | Sales-led: account manager, custom payout terms, dedicated support WhatsApp |
| 5.2 | **Multi-gate scan dashboard** | M | Scanner sessions per event | Real-time attendance by gate, capacity alerts |
| 5.3 | **Invoicing / PO checkout** | L | Paystack only | B2B: pay by invoice, NET-30, manual mark-paid |
| 5.4 | **Sponsor / exhibitor module** | L | — | Booth tiers, lead retrieval — summit-specific |
| 5.5 | **Agenda & multi-track CMS** | L | Event types IN_PERSON/VIRTUAL/HYBRID | Session schedule, speaker pages, personal agenda |
| 5.6 | **SSO / corporate auth** | M | Google sign-in exists | SAML/OIDC for enterprise buyers |

---

## Effort summary (calendar planning)

| Phase | Focus | Dev-weeks (1 FTE) | Calendar @ 2 devs | Priority |
|-------|--------|---------------------|-------------------|----------|
| **0** | Production gate | 4–6 | 2–3 weeks | **Now** |
| **1** | Trust & money | 14–20 | 2–2.5 months | **Now** |
| **2** | Growth & discovery | 12–18 | 1.5–2 months | High |
| **3** | Mobile & multi-market | 20–30 | 2.5–4 months | High (PWA subset: ~8w) |
| **4** | Creator commerce | 15–25 | 2–3 months | Optional |
| **5** | Enterprise | Ongoing | — | Differentiate |

**Minimum viable “Hustle credible” path:** Phase 0 + Phase 1 + Phase 2.1–2.3 ≈ **6–9 months** with 2 full-stack engineers.

**PWA shortcut (no native apps in year 1):** Phase 0 + 1 + 2 + 3.1 PWA only ≈ **5–7 months**.

---

## What you already have (don’t rebuild)

Use this checklist when scoping — these are **shipped** and ahead of internal docs marked GAP:

- [x] Paystack checkout + guest checkout + coupons + comp links
- [x] Waitlist with timed purchase offers
- [x] Admin moderation queue + approve/reject
- [x] Organizer sales, earnings ledger, attendee CSV
- [x] Email blast to buyers
- [x] Team invites (EDITOR / SCANNER)
- [x] Scanner session API + volunteer link management UI
- [x] Admin refunds + buyer refund requests + Paystack refund hook
- [x] Admin payout batches + Daraja B2C disburse (admin-triggered)
- [x] Wallet passes (Apple/Google, cert-gated)
- [x] WhatsApp ticket delivery opt-in (Twilio)
- [x] Platform fee + organizer net reporting
- [x] Installment 1 at checkout (automation deferred)

---

## Suggested squad split (if 2 engineers)

| Engineer A (Platform / money) | Engineer B (Product / growth) |
|-------------------------------|-------------------------------|
| 0.1–0.2 Production smoke + env | 0.3 Legal pages + 0.4 Error polish |
| 1.1 Self-serve withdrawals | 1.3 Scanner PWA `/s/[token]` |
| 1.2 M-Pesa checkout UX | 1.4 Branded organizer pages |
| 1.5 Installments automation | 2.1 Marketplace discovery |
| 3.3 Multi-country payments (later) | 2.2–2.3 Affiliate + CRM |

---

## KPIs per phase

| Phase | Metric | Target |
|-------|--------|--------|
| 0 | Staging smoke pass rate | 4/4 steps green |
| 1 | Organizer time-to-first-payout (self-serve) | < 7 days after event |
| 1 | Scan success rate at door | > 99% online |
| 2 | % sales via affiliate/referral | Track baseline → +10% |
| 2 | Marketplace organic traffic | +50% `/events` sessions |
| 3 | Mobile checkout completion | ≥ desktop conversion |
| 5 | Enterprise NPS vs Hustle | Win 1 marquee summit on governance story |

---

## Risks & dependencies

| Risk | Mitigation |
|------|------------|
| Paystack M-Pesa UX still feels “redirect-y” | Budget for Daraja STK (1.2 Option B) if conversion lagging |
| Native apps blow timeline | Ship PWA + `/s/[token]` first; defer 3.2 |
| Marketplace empty without supply | Featured curation + seed partners; sales-led onboarding (5.1) |
| Self-serve payouts + fraud | KYC on organizer profile, min balance, rate limits, admin review for first withdrawal |
| Stale internal docs | Update `AllAXS_Feature_Roadmap.md` statuses when Phase 0/1 items ship |

---

## Next 30 days (concrete backlog)

1. Run staging smoke; fix any 404 on `/v/*`, scan routes, demo event IDs.
2. Publish `/terms`, `/privacy`, `/refund-policy`, `/payout-policy`.
3. Spec self-serve withdrawal API (`1.1`) — start with Paystack Transfer to verified bank/M-Pesa on file.
4. Build `/s/[token]` volunteer scanner page (`1.3`) — unblocks every door story demo.
5. Paystack M-Pesa UX pass on checkout (`1.2` Option A) — copy, default tab, mobile layout.
6. Draft branded store RFC (`1.4`) — subdomain vs path, theming model.

---

## Document maintenance

Update this file when:
- A phase item ships (move to “Shipped” section with PR/commit ref)
- Priorities shift (e.g. enterprise deal requires 5.3 invoicing)
- HustleSasa launches new capabilities worth tracking

**Related docs:** `AllAXS_Feature_Roadmap.md` (internal feature list), `docs/STAGING_CHECKLIST.md`, `docs/ORGANIZER_PRODUCT_CHECKLIST.md`, `docs/INSTALLMENTS_FOLLOWUP.md`
