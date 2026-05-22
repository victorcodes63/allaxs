# CI: email HTML + ticket PDF smoke (POLISH-014)

Non-interactive check that transactional email HTML and ticket PDF generation do not throw. **Resend is mocked** — no live API key or outbound mail.

## Commands

| Command | Use |
|--------|-----|
| `npm run smoke:ci:email-pdf` | CI and local dry run (default recipient `ci-smoke@example.com`) |
| `DRY_RUN=1 npm run smoke:all-emails` | Same as above (delegates to `smoke:ci:email-pdf`) |
| `SMOKE_EMAIL_TO=you@example.com npm run smoke:ci:email-pdf` | Dry run with a custom “to” address (still not sent) |

Live sends (requires real `RESEND_API_KEY` in `.env`):

- `SMOKE_EMAIL_TO=you@gmail.com npm run smoke:all-emails`
- `npm run smoke:ticket-email`

## What it checks

1. `TicketPdfService.buildTicketPdfBuffer` returns a valid `%PDF-` buffer.
2. All paths in `scripts/smoke-all-emails.ts` (verification, reset, welcome, event review ×2, ticket email with PDF attachment) complete without error.

## GitHub Actions

`API CI` runs `npm run smoke:ci:email-pdf` after `npm run build`. Env uses dummy `RESEND_API_KEY` (mock prevents network calls).

## Skip conditions

| Variable | Effect |
|----------|--------|
| `SKIP_EMAIL_PDF_SMOKE=1` | Exit 0 immediately; job step skipped in spirit (script prints skip message). |
| Missing `node_modules` | Run `npm ci` first (normal CI). |
| Missing bundled logo | PDF still generates; header may omit logo until `npm run sync:brand-assets` (see POLISH-004). |

Does **not** require PostgreSQL, Redis, or `.env` — only Node + installed dependencies + `src/assets/brand/logo-mark-white.png` (optional for logo).

## Related

- Brand asset sync: `npm run sync:brand-assets`
- Web backlog: `docs/SUBAGENT_BACKLOG.md` → POLISH-014
