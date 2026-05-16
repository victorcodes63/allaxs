# Coupons — implementation spec (Phase A1)

**Audience:** the agent implementing coupons across `All_AXS_Backend-main`
(Nest) and `All_AXS_Web-main` (Next). This document is the source of truth
for the data model, validation rules, discount math, and API/UI shape.

**Origin:** May 2026 audit gap "Coupons / promo codes". Locked product
decisions from the planning thread are captured in §1.

**Status legend** (mirrors `ORGANIZER_PRODUCT_CHECKLIST.md`)

| Status | Meaning |
|--------|---------|
| **DONE** | Shipped in repo with wiring |
| **PARTIAL** | Exists but incomplete |
| **GAP** | Not implemented yet — to build |

---

## 1. Product decisions (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Scope: per-event.** Every coupon belongs to a single event. No platform-wide codes. | Matches the existing `Coupon.eventId` column. Keeps organizer ownership clear. |
| 2 | **Stacking: one coupon per order.** | Simpler UX, easier reconciliation. |
| 3 | **Caps: both per-code total and per-user.** | Marketing wants total caps for budgeting; per-user caps stop abuse. |
| 4 | **Discount applied before the platform fee.** Buyer-paid total drops, organizer absorbs the discount, platform fee is computed on the post-discount subtotal. | Easiest to explain in the ledger. Matches `computePlatformFeeCents` behaviour today (fee is a function of subtotal). |
| 5 | **Instalment plans must support coupons.** `PaymentPlan.totalAmount` and each installment amount are computed against the discounted total. | Locked in Phase D1 dependency. The instalment service must read `Order.discountCents` when it computes splits. |

Defaults for items not explicitly decided (override before build if any of
these are wrong):

| Default | Why |
|---------|-----|
| Comp / VIP links (Phase C4) bypass the coupon system entirely | Comp links are a separate 100%-discount mechanism with their own access semantics |
| Free orders (post-discount total = 0) skip Paystack initialization, go straight to PAID, issue tickets, send ticket email | Saves a gateway round-trip on 100%-off codes |
| Coupons cannot make the platform fee negative | `feesCents = max(0, computeFee(discountedSubtotal))` already does this |
| Code matching is case-insensitive at lookup, but stored as the organizer entered it | Buyers tend to type lowercase; organizers want pretty codes for marketing |

---

## 2. Data model

### 2.1 What already exists

```typescript
// src/events/entities/coupon.entity.ts (already in main)
@Entity('coupons')
class Coupon {
  code: string;               // unique, varchar(64)
  kind: 'FIXED' | 'PERCENT';
  valueCents?: number;        // for FIXED
  percentOff?: number;        // 0..100 for PERCENT
  startAt?: Date;
  endAt?: Date;
  usageLimit?: number;        // per-code total cap
  usedCount: number;          // running counter
  perUserLimit?: number;      // per-user cap
  eventId?: string | null;    // nullable today — we'll make required
  active: boolean;
}
```

### 2.2 What to add (this PR)

#### 2.2.1 `Coupon` — three new columns

| Column | Type | Purpose |
|--------|------|---------|
| `min_order_cents` | `integer NULL` | Optional minimum subtotal for the code to apply. Rejects "5,000 KES off" on a 4,000 KES order. |
| `currency` | `char(3) NULL` | If set, only orders in this currency may redeem (e.g. a USD coupon can't apply to a KES order). When `NULL`, applies to any currency. |
| Tighten `event_id` to `NOT NULL` | — | Per decision §1.1 |

Migration `AddCouponMinOrderAndCurrency<timestamp>.ts` will:

1. Backfill `event_id` from any existing rows that have it (none in prod today — `Coupon` is unused).
2. Add `min_order_cents` and `currency` as nullable.
3. Promote `event_id` to `NOT NULL`.

#### 2.2.2 New `coupon_redemptions` table

Needed to enforce per-user caps and to provide a clean audit/analytics trail.

```typescript
@Entity('coupon_redemptions')
class CouponRedemption {
  id: uuid;
  couponId: uuid;       // FK -> coupons.id, CASCADE
  orderId: uuid;        // FK -> orders.id, CASCADE — UNIQUE (1 redemption per order)
  userId: uuid | null;  // FK -> users.id, SET NULL — captured at checkout time
  email: citext;        // normalised buyer email at redemption time (for guest-checkout cap enforcement)
  discountCents: number;
  currency: char(3);
  createdAt: timestamptz;
}
```

Indexes:

- `UNIQUE (orderId)` — one coupon per order, enforced at DB level
- `INDEX (couponId, userId)` — fast per-user cap lookup for logged-in buyers
- `INDEX (couponId, email)` — fast per-user cap lookup for guest checkout

#### 2.2.3 `Order` — two new columns

| Column | Type | Purpose |
|--------|------|---------|
| `applied_coupon_id` | `uuid NULL` | FK -> coupons.id, SET NULL. Convenience pointer so order summaries don't have to join through redemptions. |
| `discount_cents` | `integer NOT NULL DEFAULT 0` | The actual discount applied at checkout time, locked at order creation. |

`amountCents` continues to mean **post-discount buyer-paid total**.
`feesCents` continues to mean **platform fee on the post-discount subtotal**.
For reporting, gross = `amountCents + discountCents`.

---

## 3. Validation rules (precedence order)

When a buyer submits `couponCode` with a checkout, the service walks this
list in order and stops at the first failure. The DTO returns a structured
error code that the frontend maps to copy.

| # | Check | Error code |
|---|-------|------------|
| 1 | Code exists (case-insensitive lookup against `LOWER(code)`) | `COUPON_NOT_FOUND` |
| 2 | `coupon.active === true` | `COUPON_INACTIVE` |
| 3 | `coupon.eventId === order.eventId` | `COUPON_WRONG_EVENT` |
| 4 | `coupon.currency === null OR coupon.currency === order.currency` | `COUPON_WRONG_CURRENCY` |
| 5 | `now >= startAt` (when `startAt` set) | `COUPON_NOT_YET_VALID` |
| 6 | `now <= endAt` (when `endAt` set) | `COUPON_EXPIRED` |
| 7 | `subtotalCents >= minOrderCents` (when set) | `COUPON_BELOW_MIN_ORDER` |
| 8 | `usageLimit IS NULL OR usedCount < usageLimit` (read inside the row lock taken in checkout transaction) | `COUPON_FULLY_REDEEMED` |
| 9 | `perUserLimit IS NULL OR redemptionsByThisUserOrEmail < perUserLimit` | `COUPON_USER_LIMIT_REACHED` |
| 10 | Computed discount produces `discountedSubtotal >= 0`. If `kind === FIXED` and `valueCents > subtotal`, cap discount at subtotal (don't reject — just give 100% off). | — (silently capped) |

The lookup in step 1, the cap check in step 8, and the redemption insert
all happen **inside the same `dataSource.transaction` block** that already
locks `TicketType` rows in `initializePaystackCheckout` /
`completeDemoCheckout`. The coupon row is taken under
`pessimistic_write` lock so concurrent redemptions can't blow past
`usageLimit`.

---

## 4. Discount math

Given:

- `subtotalCents` = `Σ line.unitPriceCents × line.qty`
- `discountCents` = depends on coupon kind, capped at `subtotalCents`
- `feesCents` = `computePlatformFeeCents(subtotalCents − discountCents)`
- `amountCents` = `subtotalCents − discountCents` (this is what the buyer pays)

### 4.1 Fixed-amount example

- Tier price: 10,000 KES × 2 = 20,000 KES subtotal
- Coupon: FIXED, `valueCents = 250000` (2,500 KES)
- Platform fee env: `PLATFORM_FEE_BPS = 500` (5%), `PLATFORM_FEE_FIXED_CENTS = 0`

Computation:
- `discountCents` = min(250000, 2000000) = 250000
- `discountedSubtotal` = 1750000
- `feesCents` = floor(1750000 × 500 / 10000) = 87500
- `amountCents` = 1750000 (buyer pays 17,500 KES)
- Organizer net = `amountCents − feesCents` = 1662500 (16,625 KES)

### 4.2 Percent example

- Tier price: 10,000 KES × 1 = 10,000 KES subtotal
- Coupon: PERCENT, `percentOff = 20`

Computation:
- `discountCents` = floor(1000000 × 20 / 100) = 200000
- `discountedSubtotal` = 800000
- `feesCents` = floor(800000 × 500 / 10000) = 40000
- `amountCents` = 800000 (buyer pays 8,000 KES)

### 4.3 100%-off edge case

If `discountedSubtotal === 0`:
1. Skip Paystack initialize entirely
2. Create order with `status = OrderStatus.PAID`, no Payment row (or a synthetic `gateway = INTERNAL, status = SUCCESS` row — TBD during implementation)
3. Increment `quantitySold` on each tier (inside the same transaction)
4. Issue tickets, fire `sendTicketEmail`
5. Return `{ status: 'PAID', authorizationUrl: null, orderId }` so the frontend skips the redirect

The existing demo flow already does most of this; we'll factor out the
common "issue tickets + email" path so both 100%-off coupons and demo
checkout use the same helper.

---

## 5. API surface

### 5.1 Backend (Nest)

#### Organizer-facing CRUD — `src/events/coupons.controller.ts` (new)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/events/:eventId/coupons` | `ORGANIZER` (must own event) or `ADMIN` | Create coupon |
| `GET` | `/events/:eventId/coupons` | `ORGANIZER` (own event) or `ADMIN` | List coupons for an event with `usedCount` and aggregated discount totals |
| `GET` | `/events/:eventId/coupons/:id` | `ORGANIZER` (own) or `ADMIN` | Read one |
| `PATCH` | `/events/:eventId/coupons/:id` | `ORGANIZER` (own) or `ADMIN` | Update (cannot edit `code` once redemptions exist — return 409) |
| `DELETE` | `/events/:eventId/coupons/:id` | `ORGANIZER` (own) or `ADMIN` | Soft-disable (`active = false`). Hard-delete only allowed if `usedCount === 0`. |

#### Public preview endpoint — `src/checkout/coupons.controller.ts` (new)

`POST /checkout/coupons/preview`

Body: `{ eventId, couponCode, lines: [{ ticketTypeId, quantity }] }`

Returns:
```typescript
{
  valid: boolean;
  errorCode?: 'COUPON_NOT_FOUND' | 'COUPON_INACTIVE' | ...;
  subtotalCents?: number;
  discountCents?: number;
  feesCents?: number;
  amountCents?: number;
  currency?: string;
}
```

This is what the buyer checkout page calls before submitting, so the
total can update in real time. **Does not consume `usageLimit`** — pure
read.

Throttle: reuse the existing `ThrottlerModule` config, cap at 30
requests / minute / IP to prevent code-guessing attacks.

#### Modified checkout endpoints

`PaystackInitDto` and `DemoCheckoutDto` gain one optional field:

```typescript
@IsOptional() @IsString() @Length(1, 64)
couponCode?: string;
```

`initializePaystackCheckout` and `completeDemoCheckout` are updated to:

1. After computing `totalCents` from the lines but before calling
   `computePlatformFeeCents`, call a new `CouponsService.redeem(manager, {
   code, eventId, userId, email, subtotalCents, currency })`.
2. `redeem` runs the validation rules in §3 inside the existing
   transaction, takes a `pessimistic_write` lock on the coupon row,
   increments `usedCount`, returns `{ couponId, discountCents }`.
3. Caller computes `discountedSubtotal = subtotalCents - discountCents`,
   passes that to `computePlatformFeeCents`, stores
   `appliedCouponId` + `discountCents` on the `Order`, and inserts a
   `CouponRedemption` row.
4. For Paystack init, the `amount` sent to Paystack is the discounted
   total.
5. For 100%-off, follow §4.3.

#### Refund path

When `OrderRefundService.refundPaidOrder` refunds an order that has
`applied_coupon_id IS NOT NULL`:

1. Decrement `Coupon.usedCount` (under row lock)
2. Hard-delete the matching `CouponRedemption` row

This restores both the global and per-user budget. A `coupon.refunded`
audit log entry is written via the existing admin audit interceptor.

### 5.2 Frontend (Next)

Existing thin proxy routes follow the `app/api/<resource>/route.ts`
convention. Add:

| Frontend route | Calls backend | Purpose |
|----------------|---------------|---------|
| `app/api/organizer/events/[eventId]/coupons/route.ts` | `GET`/`POST /events/:eventId/coupons` | Organizer CRUD list/create |
| `app/api/organizer/events/[eventId]/coupons/[id]/route.ts` | `GET`/`PATCH`/`DELETE /events/:eventId/coupons/:id` | Organizer CRUD one |
| `app/api/checkout/coupons/preview/route.ts` | `POST /checkout/coupons/preview` | Live preview from `CheckoutExperience` |

---

## 6. Frontend surface

### 6.1 Organizer CRUD UI — `app/organizer/events/[id]/coupons/page.tsx`

Reachable via a new "Coupons" tab on the event editor sidebar (sibling to
Details, Media, Ticket Tiers, Sales). Layout matches the existing
admin/organizer table patterns:

- **Header:** event title + a "Create coupon" button
- **Table columns:** Code, Kind (FIXED/PERCENT), Value (formatted), Window (`startAt` → `endAt`), Used (`usedCount / usageLimit ?? '∞'`), Per-user cap, Status pill (Active/Inactive/Expired/Exhausted), Actions (Edit, Disable, Delete-if-unused)
- **Create/Edit modal:** themed dialog reusing `components/admin/RefundOrderDialog.tsx`'s shell. Fields: code (auto-uppercased), kind toggle, value/percent (conditional), start/end pickers, total cap, per-user cap, min order, currency (defaults to event's currency).

Validation on the client mirrors the server rules; client never trusts
its own validation alone.

### 6.2 Buyer checkout UI — `components/checkout/CheckoutExperience.tsx`

Add a collapsed "Have a code?" line between the line items and the totals
block. Clicking expands a single input + "Apply" button.

On Apply:
1. POST to `/api/checkout/coupons/preview` with the current cart lines.
2. On success, render the discount line, updated total, and a "Remove"
   chip. Stash the validated code in component state.
3. On error, show the human-readable copy mapped from `errorCode`.
4. When the buyer hits "Pay", include `couponCode` in the
   `/api/checkout/paystack/init` payload.

The preview endpoint is fire-and-forget UX — final authority is still
the redeem call inside the checkout transaction (a code could be
exhausted between preview and pay; in that case the init returns a
`COUPON_FULLY_REDEEMED` error and the UI shows it inline without
losing the cart).

### 6.3 Order confirmation / ticket email

`components/orders/OrderConfirmation.tsx` and `EmailService.sendTicketEmail`
both gain a "Discount applied" line under the subtotal when
`order.discountCents > 0`. Copy: `Coupon {CODE}  −{formattedDiscount}`.

---

## 7. Migration plan

Two TypeORM migrations, run in this order:

1. **`AddCouponMinOrderAndCurrency<timestamp>.ts`**
   - `ALTER TABLE coupons ADD COLUMN min_order_cents integer NULL`
   - `ALTER TABLE coupons ADD COLUMN currency char(3) NULL`
   - Backfill `event_id` from event admin tool (none exists in prod; this is a no-op)
   - `ALTER TABLE coupons ALTER COLUMN event_id SET NOT NULL`
2. **`AddCouponRedemptionsAndOrderDiscount<timestamp>.ts`**
   - Create `coupon_redemptions` per §2.2.2
   - `ALTER TABLE orders ADD COLUMN applied_coupon_id uuid NULL REFERENCES coupons(id) ON DELETE SET NULL`
   - `ALTER TABLE orders ADD COLUMN discount_cents integer NOT NULL DEFAULT 0`
   - Index `IDX_orders_applied_coupon_id`

Both migrations are reversible. Down migrations drop the columns and the
new table.

---

## 8. Future compatibility

### 8.1 Instalment plans (Phase D1)

When `PaymentPlansService.createPaymentPlan` is invoked from a real
buyer path, it must:

1. Receive `totalAmountCents` already net of `discountCents`.
2. Persist `coupon_redemptions.discountCents` once (at order creation),
   not per-installment.
3. Each installment amount is a split of the discounted total per §4.

No schema change needed for instalments at this stage — the discount is
baked into `Order.amountCents` already.

### 8.2 Comp / VIP links (Phase C4)

Comp links are a separate mechanism (per §1 defaults). They bypass
coupons entirely. No interaction.

### 8.3 Per-tier coupons (deferred)

Schema is ready to grow a `coupon_ticket_types` join table later
without disturbing this spec. Out of scope for this PR.

---

## 9. Telemetry / audit

Reuse the existing `AdminAuditService` and Nest interceptors:

| Action | Logged when |
|--------|-------------|
| `ORGANIZER_CREATE_COUPON` | Organizer creates a coupon |
| `ORGANIZER_UPDATE_COUPON` | Organizer edits a coupon |
| `ORGANIZER_DELETE_COUPON` | Organizer hard-deletes or disables |
| `ADMIN_DELETE_COUPON` | Admin override |
| `COUPON_REDEEMED` | At checkout, includes `orderId`, `couponId`, `discountCents` |
| `COUPON_REFUND_RESTORED` | When `OrderRefundService` rolls back a redemption |

Pino logs at info level on the redemption path with a structured payload
so deliverability/admin debugging is straightforward.

---

## 10. Tests

Backend (Nest):

- `coupons.service.spec.ts` — every validation rule in §3
- `coupons.service.spec.ts` — concurrent redemption stress test (two
  parallel checkouts on a `usageLimit = 1` coupon; one wins, one
  fails with `COUPON_FULLY_REDEEMED`)
- `checkout.service.spec.ts` — extend to cover (a) discount-then-fee
  math from §4.1/4.2 and (b) 100%-off skip-Paystack path
- `order-refund.service.spec.ts` — assert `usedCount` decrements and
  `CouponRedemption` row is removed on refund

Frontend (Cypress):

- `coupons-checkout.cy.ts` — apply a valid percent code, see total
  drop, complete checkout, assert order confirmation shows the
  discount line
- `coupons-organizer.cy.ts` — organizer creates/edits/disables a
  coupon
- `coupons-edge.cy.ts` — expired code, wrong currency, exhausted code,
  per-user cap reached (rerun checkout twice as the same user)

---

## 11. Out of scope (defer)

| Item | Why deferred |
|------|--------------|
| Platform-wide coupons | Product decision §1.1 |
| Multi-tier scoping (apply only to VIP tier) | Schema-ready; UX out of scope for v1 |
| Bulk code generation (1000 unique codes for a sponsor) | Build after first organizer asks for it |
| Coupon analytics dashboard (revenue assisted, conversion lift) | Phase D3 organizer analytics |
| Affiliate / influencer attribution via coupon | Out of scope — coupons aren't an attribution system |

---

## 12. Implementation order (for the next agent)

| # | Step | Status |
|---|------|--------|
| 1 | **Migration 1 + entity update** — `Coupon` gains `min_order_cents`, `currency`, NOT NULL `event_id` | **DONE** (`1762980000000-AddCouponMinOrderAndCurrency`) |
| 2 | **Migration 2 + new entities** — `CouponRedemption`, `Order.appliedCouponId`, `Order.discountCents` | **DONE** (`1762981000000-AddCouponRedemptionsAndOrderDiscount`, `domain/coupon-redemption.entity.ts`, `domain/order.entity.ts`) |
| 3 | **`CouponsService` + organizer CRUD** (backend + frontend proxies + organizer UI) | **DONE** — `events/coupons.{service,controller}.ts`, `dto/*coupon*.ts`, `lib/coupons-api.ts`, `components/organizer/coupons/CouponFormDialog.tsx`, `components/organizer/event-editor/EventCouponsTab.tsx`. New **Coupons** tab in both `app/organizer/events/[id]/edit/page.tsx` and `app/admin/events/[id]/edit/page.tsx`. |
| 4 | **`/checkout/coupons/preview`** endpoint and frontend integration in `CheckoutExperience.tsx` | **DONE** — `checkout/dto/coupon-preview.dto.ts`, `CheckoutService.previewCoupon`, `CheckoutController.previewCoupon` (JWT-optional), `app/api/checkout/coupons/preview/route.ts`, `lib/checkout-coupons.ts`. Buyer step shows "Have a code?" section with apply / remove and live discount line. |
| 5 | **Checkout redeem path** — inject into `initializePaystackCheckout`, `completeDemoCheckout` | **DONE** — both flows call `CouponsService.redeem` inside their existing transaction. The order is created provisionally, redeem locks the coupon and writes `coupon_redemptions`, then `amountCents`, `discountCents`, `appliedCouponId`, `feesCents` are reconciled before the payment row is written. Paystack metadata carries `appliedCouponId` + `discountCents`. |
| 6 | **100%-off skip-Paystack path** | **DONE** — after the init transaction, if `chargeableCents === 0` the service calls `finalizeSuccessfulPayment(reference, …, 'free_order')` (issues tickets, sends email, runs ledger) and returns `{ status: 'PAID', authorizationUrl: null }`. Frontend redirects to `/orders/:id/confirmation` instead of Paystack. |
| 7 | **Refund rollback** — restore `usedCount` + delete `CouponRedemption` | **PARTIAL** — `CouponsService.rollbackRedemption(manager, orderId)` is in place. Still TODO: call it from `OrderRefundService.refundPaidOrder` inside the existing refund transaction. |
| 8 | **OrderConfirmation + ticket email copy** — surface discount line | **GAP** |
| 9 | **Tests** (unit + integration + Cypress) | **GAP** |
| 10 | **Update `ORGANIZER_PRODUCT_CHECKLIST.md`** — move "Coupons" from GAP → DONE with PR ref | **GAP** |

---

_Created during the post-audit planning thread. Update this doc inline as
decisions evolve; treat anything in §1 as locked unless explicitly
revisited._
