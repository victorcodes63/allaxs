# Notification dispatch architecture

Unified queue for outbound notifications across **EMAIL**, **SMS**, **WHATSAPP**, and **PUSH** (in-app) channels.

## Overview

Producers enqueue rows in the `notifications` table with `status = PENDING`. A background worker drains the queue, routes each row to the correct channel adapter, and transitions status to **SENT** or **FAILED**.

```
Producer (checkout, future blasts)
        │
        ▼
 NotificationDispatcherService / NotificationsService.enqueue*()
        │
        ▼
 notifications table (PENDING)
        │
        ▼
 NotificationProcessorTask (@Cron every 30s)
        │
        ▼
 NotificationsService.processPendingBatch()
        │
   ┌────┴────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼
 EMAIL      PUSH       SMS        WHATSAPP
 EmailService  in-app   AT adapter  Twilio adapter
```

## Data model

| Column | Purpose |
|--------|---------|
| `channel` | `EMAIL` \| `SMS` \| `WHATSAPP` \| `PUSH` |
| `template` | Adapter key, e.g. `ticket_email`, `ticket_delivery` |
| `to` | Recipient address (email, phone, or user email for PUSH) |
| `payload` | JSON template data |
| `status` | `PENDING` → `SENT` \| `FAILED` |
| `retryCount` | Incremented on transient failure |
| `error` | Last failure message when retrying or failed |

## Services

| Service | Role |
|---------|------|
| `NotificationsService` | Enqueue, dispatch, retry, hub inbox |
| `NotificationDispatcherService` | Thin facade for checkout / legacy callers |
| `NotificationProcessorTask` | Cron worker (every 30s) |

## Channel routing

- **EMAIL** — `ticket_email` / `ticket_delivery` → `EmailService.sendTicketEmail`
- **PUSH** — Row payload is the in-app notification; dispatch marks `SENT`
- **SMS** — Africa's Talking when `AT_*` env configured; template `ticket_delivery`
- **WHATSAPP** — Twilio when `WHATSAPP_PROVIDER=twilio`; template `ticket_delivery`. See `docs/WHATSAPP_TICKET_DELIVERY.md`

## Retry policy

- Env `NOTIFICATION_MAX_RETRIES` (default `3`)
- Transient errors: increment `retryCount`, stay `PENDING`
- Permanent errors (unknown template, unconfigured channel): `FAILED` immediately

## Worker configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `NOTIFICATION_DISPATCH_ENABLED` | `true` | Toggle cron worker |
| `NOTIFICATION_MAX_RETRIES` | `3` | Max attempts before FAILED |
| `NOTIFICATION_DISPATCH_BATCH_SIZE` | `25` | Rows per cron tick |

## Ticket email flow

Checkout calls `NotificationDispatcherService.enqueueTicketEmail(...)`, which enqueues a `PENDING` row and runs inline dispatch so buyers receive tickets immediately. The cron worker retries failures.

## Follow-up

- **AUDIT-B2** — SMS checkout opt-in wiring — shipped (Africa's Talking adapter)
- **AUDIT-B3** — WhatsApp checkout opt-in wiring — shipped (Twilio adapter)
- **AUDIT-D4** — Organizer email blast enqueues bulk `EMAIL` rows

## Files

- `src/notifications/notifications.service.ts` — core dispatcher
- `src/notifications/notification-dispatcher.service.ts` — facade
- `src/notifications/notification-processor.task.ts` — cron worker
- `src/domain/notification.entity.ts` — entity + `retryCount`
- `src/database/migrations/1747929600000-AddNotificationRetryCount.js`
