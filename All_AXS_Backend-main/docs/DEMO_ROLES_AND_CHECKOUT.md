# Demo roles (organizer vs attendee) and DB checkout

## How roles are stored

Users live in `users`. The `roles` column is a **PostgreSQL enum array** (`ADMIN`, `ORGANIZER`, `ATTENDEE`).

- **Attendee (buy tickets):** `roles = {ATTENDEE}` — this is what `**POST /auth/register`** creates by default.
- **Organizer (create events):** must include `**ORGANIZER`**. An organizer also has a row in `**organizer_profiles`** (linked by `userId`) before they can own events.

You can inspect or change roles in SQL (example):

```sql
-- Add ORGANIZER to an existing user by email (Postgres array literal)
UPDATE users
SET roles = array_append(roles, 'ORGANIZER'::users_roles_enum)
WHERE email = 'you@example.com'
  AND NOT ('ORGANIZER'::users_roles_enum = ANY(roles));
```

## API: grant yourself ORGANIZER in dev (optional)

When `NODE_ENV` is **not** `production`, or when `**ENABLE_PROMOTE_ORGANIZER_ROLE=true`**:

`POST /auth/promote-organizer-demo`  
Headers: `Authorization: Bearer <access_token>`

Response matches login: `{ user, tokens }`. The Next.js app can proxy this route and refresh cookies (see web `POST /api/auth/promote-organizer`).

After promotion, the **JWT strategy still loads roles from the database** on each request, so organizer-only API routes see the new role even before refreshing cookies—but the **Next `/api/auth/me` JWT decoder** may show stale roles until cookies are updated from the response tokens.

## Seeded demo users + published event

```bash
cd All_AXS_Backend-main
npm run seed:demo
```

Creates (if missing):


| Account   | Email                        | Password       | Roles                            |
| --------- | ---------------------------- | -------------- | -------------------------------- |
| Organizer | `demo-organizer@allaxs.demo` | `DemoFlow123!` | ATTENDEE + ORGANIZER (+ profile) |
| Attendee  | `demo-attendee@allaxs.demo`  | `DemoFlow123!` | ATTENDEE                         |
| Admin     | `demo-admin@allaxs.demo`     | `DemoFlow123!` | ADMIN                            |


Also creates one **PUBLISHED** public event with two ticket types (paid + free). The script prints `eventId`, `slug`, and `ticketTypeIds`.

### Event review flow (organizer → admin)

The seed admin drives the review queue end-to-end:

1. Sign in as the **organizer** (`demo-organizer@allaxs.demo`), open an event editor, and click **Submit for review** — the event moves to `PENDING_REVIEW` and a notification fires to every admin.
2. Sign in as the **admin** (`demo-admin@allaxs.demo`), visit `/admin/moderation`, click **Review** on the queued event, and choose **Approve** or **Reject**.
3. Approval flips the event to `PUBLISHED` (now visible on `/events`); rejection flips it to `REJECTED` and stores the optional reason on `event.metadata.rejectionReason`. Either way, the organizer is notified and the event surfaces under **Needs your attention** until they action it (rejected events are editable and can be **Resubmit**ted).

Re-run `npm run seed:demo` any time — the admin step is idempotent. Existing rows are reconciled to include the `ADMIN` role (other roles are preserved) and the display name is normalised to `Demo Admin`.

## Persisted demo checkout (Neon)

1. Set `**ENABLE_DEMO_CHECKOUT=true`** in the API environment (required in **production**; in dev it is allowed when `NODE_ENV !== 'production'` without the flag—see `CheckoutService`).
2. Authenticated `**POST /checkout/demo`** with body:

```json
{
  "eventId": "<uuid>",
  "lines": [{ "ticketTypeId": "<uuid>", "quantity": 1 }],
  "buyerName": "Ada Lovelace",
  "buyerEmail": "ada@example.com",
  "buyerPhone": "+254700000000"
}
```

Creates a **PAID** order, **SUCCESS** Paystack-style payment row (`intentId` prefix `demo_pay_`), increments `**ticket_types.quantity_sold`**, and issues `**tickets`** with `qrNonce` + HMAC `qrSignature` (server secret: `JWT_SECRET`).

1. `**GET /tickets/me**` — list passes for the logged-in owner.
2. `**GET /tickets/:id**` — one pass (owner only).
3. `**GET /checkout/orders/:orderId**` — order summary for confirmation (owner only).

## Web app wiring

Set:

- `NEXT_PUBLIC_USE_DEMO_EVENTS=false` — so `/events` loads from the API (your seeded event appears after seed + correct `NEXT_PUBLIC_API_BASE_URL`).
- `NEXT_PUBLIC_USE_API_CHECKOUT=true` — checkout + tickets use the proxied API instead of session-only stubs.

See the web `README.md` “Demo attendee journey (API checkout)” section.

## Platform fees (Phase 1)

Optional env vars on the API (defaults keep `feesCents` at **0**):

| Variable | Meaning |
| -------- | ------- |
| `PLATFORM_FEE_BPS` | Basis points on the order subtotal (e.g. `500` = 5%). |
| `PLATFORM_FEE_FIXED_CENTS` | Flat fee per order (added to the percent part). |
| `PLATFORM_FEE_MAX_CENTS` | Cap on the computed fee (after percent + fixed). |

Buyer still pays the ticket subtotal (`orders.amountCents`). `orders.feesCents` is the platform share; organizer-facing **net** is `amountCents − feesCents` (shown in organizer sales APIs and the web hub).

## Admin refunds

`POST /admin/orders/:id/refund` calls Paystack’s refund API for non-demo orders (requires `PAYSTACK_SECRET_KEY`), then voids tickets, restores `ticket_types.quantity_sold`, and sets order + payment to **REFUNDED**. Orders whose `reference` starts with `demo_` skip Paystack. Partial refund amounts are rejected until supported end-to-end.