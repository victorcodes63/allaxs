# WhatsApp ticket delivery (AUDIT-B3)

Twilio WhatsApp Business adapter for post-checkout ticket links. Integrates with the unified notification dispatcher (`NotificationsService`) on the `WHATSAPP` channel.

## Provider choice

**Twilio** (not Meta Cloud API directly):

- Single REST API with sandbox for local dev
- Content Template API maps to WhatsApp Business approved templates
- Reuses existing `fetch`-based adapter pattern (no extra npm dependency)

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `WHATSAPP_PROVIDER` | No | `none` | Set to `twilio` to enable |
| `TWILIO_ACCOUNT_SID` | When provider=twilio | — | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | When provider=twilio | — | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | When provider=twilio | — | Sender, e.g. `whatsapp:+14155238886` |
| `TWILIO_WHATSAPP_CONTENT_SID` | Prod recommended | — | Approved Content Template SID |
| `WHATSAPP_DRY_RUN` | No | `false` | Log message body, skip API call |
| `WHATSAPP_TICKET_DELIVERY` | No | `true` | Set `false` to disable ticket WhatsApp |

See also `docs/NOTIFICATION_DISPATCH.md` for queue/worker env vars.

## Template

Template key: `ticket_delivery` (`TICKET_WHATSAPP_TEMPLATE`).

**Content variables** (when `TWILIO_WHATSAPP_CONTENT_SID` is set):

| Variable | Value |
|----------|--------|
| `{{1}}` | Buyer name (or "there") |
| `{{2}}` | Event title |
| `{{3}}` | Ticket verify URL(s), newline-separated if multiple |

Example approved body:

```
Hi {{1}}, your All AXS pass for {{2}} is ready: {{3}}. Show the QR at the door.
```

**Without Content SID** (sandbox/dev): a freeform body is sent via Twilio Messages API.

## Optional QR image

When enabled (default), the first ticket verify URL is encoded as a public QR image via `api.qrserver.com` and attached as Twilio `MediaUrl`. Disable per-send with `includeQrImage: false` on `enqueueTicketWhatsApp`.

## Checkout integration

Buyers opt in with:

```json
{
  "ticketDelivery": "email_and_whatsapp",
  "buyerPhone": "+254700000000"
}
```

Stored in `orders.notes` JSON. After payment, `sendOrderTicketEmail` also calls `sendOrderTicketWhatsApp` when `ticketDelivery === 'email_and_whatsapp'` and phone is present.

## Local smoke test

```bash
WHATSAPP_PROVIDER=twilio \
WHATSAPP_DRY_RUN=true \
TWILIO_ACCOUNT_SID=ACxxx \
TWILIO_AUTH_TOKEN=xxx \
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
npm run test -- twilio-whatsapp.adapter.spec
```

## Files

- `src/notifications/adapters/twilio-whatsapp.adapter.ts`
- `src/notifications/templates/ticket-whatsapp.template.ts`
- `src/notifications/order-notes.util.ts`
- `src/notifications/notifications.service.ts` — `enqueueTicketWhatsApp`, `dispatchWhatsApp`
