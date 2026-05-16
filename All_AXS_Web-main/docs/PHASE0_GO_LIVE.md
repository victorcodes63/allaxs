# Phase 0 — Production actually works

Goal: **Pay → email → scan → refund** is green on staging/production, with guards so demo catalog cannot ship again.

**Repos:** Web (`All_AXS_Web-main`) + API ([All_AXS_Backend-main](https://github.com/victorcodes63/All_AXS_Backend-main)).

---

## What shipped in the Web repo

| Item | Location |
|------|----------|
| Production env gate (fails Vercel Production build) | `scripts/validate-production-env.mjs` (`prebuild`) |
| CI uses same rules on `main` / `dev` | `.github/workflows/web-ci.yml` |
| Demo catalog forced off on Vercel Production | `lib/public-events-mode.ts` |
| Paystack init rejects non-UUID event/tier ids | `app/api/checkout/paystack/init/route.ts` |
| Sentry (optional until DSN set) | `instrumentation.ts`, `sentry.*.config.ts`, `next.config.ts` |

---

## 1. Vercel — Web project (`allaxs`)

Set in **Production** (and Preview if you smoke-test previews):

```env
NEXT_PUBLIC_API_BASE_URL=https://all-axs-backend-main.vercel.app
API_URL=https://all-axs-backend-main.vercel.app

NEXT_PUBLIC_SITE_URL=https://allaxs.vercel.app

NEXT_PUBLIC_USE_DEMO_EVENTS=false
NEXT_PUBLIC_USE_API_CHECKOUT=true

# After creating a Sentry project (optional but recommended)
SENTRY_DSN=https://…@….ingest.sentry.io/…
NEXT_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
```

**Do not** set `NEXT_PUBLIC_USE_DEMO_EVENTS=true` on Production — the build will **fail**.

Redeploy: Vercel → Deployments → … → **Redeploy** (or push to `main`).

---

## 2. Vercel — API project (`all-axs-backend-main`)

Set in **Production** (see also `docs/STAGING_CHECKLIST.md`):

```env
FRONTEND_URL=https://allaxs.vercel.app

PAYSTACK_SECRET_KEY=sk_test_…   # or live when ready
RESEND_API_KEY=re_…
RESEND_FROM="All AXS <tickets@your-domain.com>"

DATABASE_URL=postgresql://…
JWT_SECRET=…
JWT_REFRESH_SECRET=…
```

**Paystack dashboard:** Webhook URL =  
`https://all-axs-backend-main.vercel.app/api/webhooks/paystack`

Redeploy API so routes exist: `/v` verify links are built with `FRONTEND_URL`, scan controllers, webhooks.

---

## 3. Sentry (Web + API)

### Web (this repo)

1. [sentry.io](https://sentry.io) → project **Next.js** → copy DSN.
2. Vercel Web → Environment Variables → add `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (same value).
3. Redeploy. Errors appear even without source maps.
4. Optional source maps: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` on Vercel.

### API (backend repo)

1. Second Sentry project **Node/Nest**.
2. Install `@sentry/nestjs` (or `@sentry/node`) in the API repo and init in `main.ts`.
3. Alert rule: **Paystack webhook handler errors** or **order stuck PENDING > 15m** (if you add a cron).

---

## 4. Smoke test (manual gate)

Use a **real inbox** (not `*@allaxs.demo` — Paystack may reject demo emails).

| Step | Action | Pass criteria |
|------|--------|----------------|
| **1 Pay** | `/events` → pick a **UUID** event → checkout → Paystack test card | Order **PAID** in `/admin/orders` |
| **2 Email** | Check inbox + Resend dashboard | Ticket/receipt received |
| **3 Scan** | Open QR → `/v/…` loads; `/organizer/tickets/scan` or `/admin/scan` | Check-in succeeds once |
| **4 Refund** | Admin → refund that order | **REFUNDED**; Paystack refund (test mode) |

Log results in `docs/STAGING_CHECKLIST.md` → **Smoke log** table.

**Paystack test card:** `4084084084084081`, CVV `408`, future expiry, PIN `0000`, OTP `123456`.

---

## 5. Verify production guards

```bash
# Should pass (CI simulation)
ENFORCE_PRODUCTION_ENV=true \
  NEXT_PUBLIC_USE_DEMO_EVENTS=false \
  NEXT_PUBLIC_USE_API_CHECKOUT=true \
  API_URL=https://api.example.com \
  NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  NEXT_PUBLIC_SITE_URL=https://web.example.com \
  npm run validate:production-env

# Should fail
ENFORCE_PRODUCTION_ENV=true NEXT_PUBLIC_USE_DEMO_EVENTS=true npm run validate:production-env
```

---

## 6. Unblock checklist (from 2026-05-16 smoke)

- [ ] Web Production: `NEXT_PUBLIC_USE_DEMO_EVENTS=false`, API URLs set, redeployed
- [ ] API Production: `FRONTEND_URL` = Web URL, Paystack + Resend set, redeployed
- [ ] `/v/{token}` returns 200 (not 404)
- [ ] `/organizer/tickets/scan` and scan API routes return 200
- [ ] One full Pay → Email → Scan → Refund logged as **pass**

---

## Local development

- `npm run build` on your laptop does **not** enforce production env (unless you set `ENFORCE_PRODUCTION_ENV=true`).
- Demo catalog: `NEXT_PUBLIC_USE_DEMO_EVENTS=true` in `.env.local` (do not use with Paystack).
- Sentry: omit DSN locally; SDK stays disabled.

---

## Next (Phase 1)

Attendee CSV export, fee transparency on checkout, organizer payout statements, Cypress in CI — see platform audit / `docs/ORGANIZER_PRODUCT_CHECKLIST.md`.
