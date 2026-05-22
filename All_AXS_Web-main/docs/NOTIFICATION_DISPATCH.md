# Notification dispatch (Web reference)

The API notification platform is documented in the backend repo:

**[All_AXS_Backend-main/docs/NOTIFICATION_DISPATCH.md](../../All_AXS_Backend-main/docs/NOTIFICATION_DISPATCH.md)**

Summary:

- All async outbound notifications (EMAIL/SMS/WHATSAPP/PUSH) are queued in the `notifications` table.
- Checkout ticket emails enqueue via `NotificationDispatcherService.enqueueTicketEmail` instead of calling Resend directly.
- A cron worker retries failed rows; hub PUSH notifications remain synchronous via `NotificationsService.createInAppNotification`.

Unblocks **AUDIT-B2** (SMS), **AUDIT-B3** (WhatsApp), **AUDIT-D4** (organizer blasts).
