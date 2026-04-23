# Demo roles (organizer vs attendee) and DB checkout

## How roles are stored

Users live in `users`. The `roles` column is a **PostgreSQL enum array** (`ADMIN`, `ORGANIZER`, `ATTENDEE`).

- **Attendee (buy tickets):** `roles = {ATTENDEE}` — this is what **`POST /auth/register`** creates by default.
- **Organizer (create events):** must include **`ORGANIZER`**. An organizer also has a row in **`organizer_profiles`** (linked by `userId`) before they can own events.

You can inspect or change roles in SQL (example):

```sql
-- Add ORGANIZER to an existing user by email (Postgres array literal)
UPDATE users
SET roles = array_append(roles, 'ORGANIZER'::users_roles_enum)
WHERE email = 'you@example.com'
  AND NOT ('ORGANIZER'::users_roles_enum = ANY(roles));
```

## API: grant yourself ORGANIZER in dev (optional)

When `NODE_ENV` is **not** `production`, or when **`ENABLE_PROMOTE_ORGANIZER_ROLE=true`**:

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

| Account | Email | Password | Roles |
|--------|-------|----------|--------|
| Organizer | `demo-organizer@allaxs.demo` | `DemoFlow123!` | ATTENDEE + ORGANIZER (+ profile) |
| Attendee | `demo-attendee@allaxs.demo` | `DemoFlow123!` | ATTENDEE |

Also creates one **PUBLISHED** public event with two ticket types (paid + free). The script prints `eventId`, `slug`, and `ticketTypeIds`.

## Persisted demo checkout (Neon)

1. Set **`ENABLE_DEMO_CHECKOUT=true`** in the API environment (required in **production**; in dev it is allowed when `NODE_ENV !== 'production'` without the flag—see `CheckoutService`).
2. Authenticated **`POST /checkout/demo`** with body:

```json
{
  "eventId": "<uuid>",
  "lines": [{ "ticketTypeId": "<uuid>", "quantity": 1 }],
  "buyerName": "Ada Lovelace",
  "buyerEmail": "ada@example.com",
  "buyerPhone": "+254700000000"
}
```

Creates a **PAID** order, **SUCCESS** Paystack-style payment row (`intentId` prefix `demo_pay_`), increments **`ticket_types.quantity_sold`**, and issues **`tickets`** with `qrNonce` + HMAC `qrSignature` (server secret: `JWT_SECRET`).

3. **`GET /tickets/me`** — list passes for the logged-in owner.  
4. **`GET /tickets/:id`** — one pass (owner only).  
5. **`GET /checkout/orders/:orderId`** — order summary for confirmation (owner only).

## Web app wiring

Set:

- `NEXT_PUBLIC_USE_DEMO_EVENTS=false` — so `/events` loads from the API (your seeded event appears after seed + correct `NEXT_PUBLIC_API_BASE_URL`).
- `NEXT_PUBLIC_USE_API_CHECKOUT=true` — checkout + tickets use the proxied API instead of session-only stubs.

See the web `README.md` “Demo attendee journey (API checkout)” section.
