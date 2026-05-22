# Guest checkout & account linking

How All AXS handles purchases when the buyer is not signed in before checkout.

## Summary

**Guest checkout silently creates an attendee account** at purchase time. The order and tickets are linked to that account immediately via `userId`—there is no separate “link tickets later” step.

## Flow

### New email (first-time buyer)

1. Buyer completes checkout without signing in.
2. API provisions an attendee account for the checkout email (`autoCreatedAt` is set on the user).
3. Order and tickets are assigned to that user.
4. After payment, the buyer is **auto signed-in** in the browser (session cookies issued) **or** can open **My tickets** via the magic link in the ticket email.
5. To sign in on another device later: use **Set a password** (`/forgot-password`) with the same email, or the secure link from the ticket email.

### Existing email (account already registered)

1. Buyer must **sign in** before checkout—not register again.
2. If they try to register with that email, they see guidance to sign in or set a password (for auto-provisioned accounts).

### Register after a guest purchase

Do **not** use `/register` for an email that already has an account (including auto-provisioned guest accounts). Use **Set a password** via `/forgot-password?email=…` instead.

## Where this is implemented

| Layer | Behavior |
|--------|----------|
| **API** | `AuthService` / `UsersService` provision buyer; `CheckoutService` sets `guestCheckout: true` in order notes |
| **Web** | `PublicGuestCheckout` sends guest flag; confirmation page shows account-created copy; `AutoCreatedAccountBanner` on dashboard |
| **Order notes** | JSON metadata: `{ guestCheckout, buyerName, ticketDelivery }` — parsed by `parseOrderNotes` |

## UI copy guidelines

- Confirmation (guest + API): “We created an account for {email}” + **Set a password** + **My tickets**
- Do not link to `/register` from guest confirmation—the account already exists
- Register page 409: point to forgot-password / set password

## Related env

- `NEXT_PUBLIC_USE_API_CHECKOUT=true` — live Paystack + API orders (required for guest provisioning in production)
