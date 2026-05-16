# Staging environment checklist

Use this before calling staging “ready” for paid checkout and email flows.

Set variables in **Vercel → Project → Settings → Environment Variables** (Preview and/or Production). Do not commit secrets. Copy the blocks below into the dashboard and replace placeholders.

**Related docs:** Web [VERCEL.md](./VERCEL.md) · API `All_AXS_Backend-main/docs/VERCEL.md` · Web [.env.example](../.env.example) · API [.env.example](../../All_AXS_Backend-main/.env.example) (backend repo).

---

## Environment variable map

| Concern | API (Nest) | Web (Next.js) | Must match |
| -------- | ----------- | ------------- | ---------- |
| Public site origin (emails, verify/reset links) | `FRONTEND_URL` | `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_BASE_URL`) | **Yes** — same HTTPS origin, no trailing slash |
| Ticket QR in PDF email (`/v/...`) | `FRONTEND_URL` (API builds QR URL) | `NEXT_PUBLIC_SITE_URL` (SSR/OG only) | **Yes** — QR uses **API** `FRONTEND_URL`, not the Next env alone |
| Paystack return after payment | `PAYSTACK_CALLBACK_URL` (optional) | — | Defaults to `{FRONTEND_URL}/orders/payment/callback` if unset |
| API base for proxies + client | — | `API_URL` + `NEXT_PUBLIC_API_BASE_URL` | **Yes** — same staging API URL |
| Real checkout (not session-only) | Paystack keys on API | `NEXT_PUBLIC_USE_API_CHECKOUT=true` | Web flag required for Paystack init proxy |
| Order / ticket emails | `RESEND_API_KEY`, `RESEND_FROM` | — | Verified domain in Resend |
| HTML email wordmark | `FRONTEND_URL` → `/brand/logo-header.png` | `public/brand/logo-header.png` | Optional override: API `EMAIL_LOGO_URL` |
| Paystack charges + refunds | `PAYSTACK_SECRET_KEY` | — | Test key on staging |
| Paystack webhooks | `PAYSTACK_WEBHOOK_SECRET` (optional) | — | Falls back to `PAYSTACK_SECRET_KEY` if unset |
| Paystack dashboard webhook URL | — | — | `https://<staging-api-host>/api/webhooks/paystack` |
| Catalog from API | — | `NEXT_PUBLIC_USE_DEMO_EVENTS=false` | Omit or `false` on staging |
| Google sign-in | `GOOGLE_CLIENT_ID` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **Yes** — same OAuth client |
| Platform fee (optional) | `PLATFORM_FEE_BPS`, `PLATFORM_FEE_FIXED_CENTS`, `PLATFORM_FEE_MAX_CENTS` | — | See API `docs/DEMO_ROLES_AND_CHECKOUT.md` |

**Not used today:** Paystack public key is not required on the Web app (checkout calls `/api/checkout/paystack/init`, which proxies to the API). Prefer `NEXT_PUBLIC_API_BASE_URL` over legacy `NEXT_PUBLIC_API_URL` (some files accept both).

---

## Copy-paste: API (Vercel — backend project)

```env
# --- Staging API (replace placeholders; set in Vercel Preview and/or Production) ---
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require

JWT_SECRET=generate-a-long-random-string
JWT_REFRESH_SECRET=generate-another-long-random-string

# Must equal the staging Web deployment URL (no trailing slash)
FRONTEND_URL=https://your-staging-web.vercel.app

# Email (required when EMAIL_PROVIDER=resend, the default)
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM="All AXS <tickets@your-verified-domain.com>"

# Paystack test mode on staging
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
# Optional dedicated webhook secret; if omitted, PAYSTACK_SECRET_KEY is used for signature verification
# PAYSTACK_WEBHOOK_SECRET=whsec_or_paystack_test_secret

# Optional; default is FRONTEND_URL + /orders/payment/callback
# PAYSTACK_CALLBACK_URL=https://your-staging-web.vercel.app/orders/payment/callback

# Optional platform fee (defaults: all zero)
# PLATFORM_FEE_BPS=500
# PLATFORM_FEE_FIXED_CENTS=0
# PLATFORM_FEE_MAX_CENTS=

# Optional Google (must match Web NEXT_PUBLIC_GOOGLE_CLIENT_ID)
# GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com

# Demo without mail only:
# EMAIL_PROVIDER=none
```

**Paystack dashboard (staging):** Webhook URL = `https://<your-staging-api>.vercel.app/api/webhooks/paystack`.

---

## Copy-paste: Web (Vercel — frontend project)

```env
# --- Staging Web (replace placeholders; set in Vercel Preview and/or Production) ---
NEXT_PUBLIC_API_BASE_URL=https://your-staging-api.vercel.app
API_URL=https://your-staging-api.vercel.app

# Same origin as API FRONTEND_URL
NEXT_PUBLIC_SITE_URL=https://your-staging-web.vercel.app

# Use real API checkout + Paystack (not sessionStorage-only demo)
NEXT_PUBLIC_USE_API_CHECKOUT=true

# Load public events from API (not bundled demo fixtures)
NEXT_PUBLIC_USE_DEMO_EVENTS=false

# Optional Google (must match API GOOGLE_CLIENT_ID)
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

---

## Backend (Nest API) — checklist

- **Database** — `DATABASE_URL` points at staging Postgres (Neon or equivalent); migrations applied once (`npm run migrate:run`).
- **Auth** — `JWT_SECRET`, `JWT_REFRESH_SECRET` set (not localhost defaults on Vercel).
- **`FRONTEND_URL`** — Staging **Web** origin (password reset, verification links, **ticket QR URLs in PDFs**).
- **Resend** — `RESEND_API_KEY` and `RESEND_FROM` with a verified sender domain; check Resend logs if mail is missing.
- **Paystack** — `PAYSTACK_SECRET_KEY` (test key on staging).
- **Paystack webhook** — Dashboard URL = `https://<staging-api>/api/webhooks/paystack`; signature secret = `PAYSTACK_WEBHOOK_SECRET` or `PAYSTACK_SECRET_KEY`.
- **`PAYSTACK_CALLBACK_URL`** — Optional. If unset, callback is `{FRONTEND_URL}/orders/payment/callback` (must match the Web route `app/orders/payment/callback`).
- **Platform fee** — `PLATFORM_FEE_BPS`, `PLATFORM_FEE_FIXED_CENTS`, `PLATFORM_FEE_MAX_CENTS` as intended; confirm a test order’s totals.
- **Google sign-in (optional)** — `GOOGLE_CLIENT_ID` matches Web `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Web (Next.js) — checklist

- **`NEXT_PUBLIC_API_BASE_URL`** and **`API_URL`** — Staging API base URL (HTTPS; not `localhost`).
- **`NEXT_PUBLIC_SITE_URL`** — Canonical staging site URL (metadata, OG; should match `FRONTEND_URL`).
- **`NEXT_PUBLIC_USE_API_CHECKOUT`** — `true` for real Paystack init from signed-in checkout.
- **`NEXT_PUBLIC_USE_DEMO_EVENTS`** — `false` (or omit in production) so `/events` uses the API.
- **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** — Optional; same OAuth client as API.

---

## Common misconfigurations

| Symptom | Likely cause | Fix |
| -------- | ------------- | ----- |
| Ticket QR opens `localhost` or wrong host | API `FRONTEND_URL` still default / wrong | Set API `FRONTEND_URL` to staging Web URL; redeploy API |
| Paystack succeeds but order stays pending | Webhook not reaching API or bad signature | Paystack webhook URL → staging API `/api/webhooks/paystack`; align `PAYSTACK_WEBHOOK_SECRET` or use same value as secret key |
| Paystack redirect 404 or wrong site | `PAYSTACK_CALLBACK_URL` / `FRONTEND_URL` mismatch | Use `https://<staging-web>/orders/payment/callback` or leave callback unset and fix `FRONTEND_URL` |
| “Cannot reach API” on login/checkout | Web `API_URL` / `NEXT_PUBLIC_API_BASE_URL` wrong or localhost on Vercel | Point both at `https://<staging-api>.vercel.app` |
| Checkout uses session-only passes | `NEXT_PUBLIC_USE_API_CHECKOUT` not `true` | Set to `true` and redeploy Web |
| No ticket email | Missing Resend vars or unverified `RESEND_FROM` | Set `RESEND_*` on API; check Resend dashboard |
| Email links go to production | `FRONTEND_URL` points at prod Web | Use staging Web URL on **API** project env |
| Events list is demo fixtures | `NEXT_PUBLIC_USE_DEMO_EVENTS=true` | Set `false` on staging Web |
| Google sign-in fails audience check | Client ID mismatch | Same Web client ID on `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and API `GOOGLE_CLIENT_ID` |
| Refund fails on paid order | `PAYSTACK_SECRET_KEY` missing on API | Set test/live secret on API staging env |

---

## Single happy-path smoke test

1. **Pay** — Sign in (or register), complete checkout for a small paid tier; Paystack succeeds and order is `PAID` (or equivalent) in admin.
2. **Email** — Receipt or ticket email arrives from Resend (check spam and Resend logs).
3. **Scan** — Open ticket QR; URL should be `https://<staging-web>/v/...`. Mark check-in once via organizer/admin scanner.
4. **Refund** — In admin, issue a **full** refund on that order; confirm Paystack refund and tickets voided / inventory restored per product rules.

Record the test order reference and any webhook delivery IDs in your incident log if this is a formal go-live gate.

### Smoke log (POLISH-002)

| Field | Value |
| ----- | ----- |
| Date | |
| Staging Web URL | |
| Staging API URL | |
| Order ID / reference | |
| Resend message ID | |
| Pay / Email / Scan / Refund | pass / fail each |

---

## Smoke log

### 2026-05-16 — POLISH-002 (agent run)

| Field | Value |
| ----- | ----- |
| **Date** | 2026-05-16 |
| **Staging Web URL** | https://allaxs.vercel.app (Vercel Production, project `rtgprojects/allaxs`) |
| **Staging API URL** | https://all-axs-backend-main.vercel.app (Vercel Production, project `rtgprojects/all-axs-backend-main`) |
| **Tester** | `demo-attendee@allaxs.demo` / `demo-admin@allaxs.demo` (password `DemoFlow123!` per API `docs/DEMO_ROLES_AND_CHECKOUT.md`) |
| **Paystack test card** (not in repo; [Paystack test docs](https://paystack.com/docs/payments/test-payments/)) | `4084084084084081`, CVV `408`, expiry any future date, PIN `0000`, OTP `123456` |
| **Order ID / reference (Pay attempt)** | `0919f206-ca5b-40a6-9283-8ccab171d69a` / `pay_0529b745909b4bfabc0ebde823a4f34f` (remained **PENDING**); UI init failed on `demo-evt-01` |
| **Order ID / reference (Refund probe)** | `a711ff79-723e-4354-96d3-e24c2c133b36` / seed wallet order (refunded during test) |
| **Resend message ID** | **BLOCKED** — no Resend dashboard/API access from agent; user must paste from Resend logs after a successful paid+email run |

| Step | Result | Notes |
| ---- | ------ | ----- |
| **1 Pay** | **FAIL** (UI) / **PARTIAL** (API) | Signed in on Web. Checkout at `/events/demo-evt-01/checkout` uses **demo fixture event IDs**, so `POST /api/checkout/paystack/init` returns **400**. API init **succeeds** with real event UUID `a31e3951-a951-46c5-8359-10b42b90ac52`, tier `acd8a21f-62f4-4010-8271-92e6cd0f2a5f`, and buyer email **not** `*@allaxs.demo` (Paystack rejected `demo-attendee@allaxs.demo`). Paystack hosted checkout opened; **card tab** hard to automate; **M-PESA** stalls on device PIN. No order reached **PAID** in admin from this run. **Follow-up:** set `NEXT_PUBLIC_USE_DEMO_EVENTS=false`, redeploy Web; confirm checkout uses API UUIDs (`POLISH-001` env gate). |
| **2 Email** | **BLOCKED** | Cannot confirm inbox or Resend message ID without operator access to Resend. Re-run after a **PAID** Paystack order with `RESEND_*` on API. |
| **3 Scan** | **FAIL** (deployed) | Built QR URL `https://allaxs.vercel.app/v/{token}` → **404** (route exists in repo, not on deployed Web). `/admin/scan`, `/organizer/tickets/scan` → **404**. API `POST /api/admin/tickets/scan` and `POST /api/organizers/tickets/scan` → **404** on deployed API. **Follow-up:** redeploy Web + API from current `main` (includes `/v/*` and scan controllers). |
| **4 Refund** | **PASS** (API) / **not E2E** | `POST https://all-axs-backend-main.vercel.app/api/admin/orders/a711ff79-723e-4354-96d3-e24c2c133b36/refund` → order **REFUNDED**, `refundAmountCents: 24900`. Web proxy returns "already refunded" on repeat. Not chained to a fresh Paystack-paid order from step 1. |

**Overall:** **BLOCKED** for full happy path on current Production deploy. Staging-specific Preview URLs were not in `.env.local` (localhost API only). Production API health OK; public catalogue loads from API on `/events`, but event checkout path still tied to **demo fixture IDs**.

**User action to unblock**

1. Vercel **Web** Production/Preview: `NEXT_PUBLIC_USE_DEMO_EVENTS=false`, `NEXT_PUBLIC_USE_API_CHECKOUT=true`, `NEXT_PUBLIC_API_BASE_URL` + `API_URL` → API URL, `NEXT_PUBLIC_SITE_URL` → Web URL; redeploy.
2. Vercel **API**: `FRONTEND_URL` → Web URL; `PAYSTACK_SECRET_KEY` (test), `RESEND_*`; redeploy so `/v`, scan, and refund routes match repo.
3. Re-run Pay with a real inbox email; copy **Resend message ID** into this log.
4. Optional: dedicated Preview env URLs if Production must not be used for smoke tests.
