# Wallet passes (Apple Wallet + Google Wallet)

MVP endpoints add signed mobile wallet passes for paid tickets. QR/barcode payloads reuse the same `/v/{token}` URL as PDF tickets (`buildTicketQrUrl` / `ticket-qr.util.ts`).

## API endpoints

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/tickets/:id/wallet/google` | JWT (ticket owner) | `{ saveUrl }` — open in browser to save to Google Wallet |
| `GET` | `/tickets/:id/wallet/apple` | JWT (ticket owner) | `.pkpass` binary (`application/vnd.apple.pkpass`) |

Web proxies (cookie session):

- `/api/tickets/[id]/wallet/google` → redirects to Google save URL
- `/api/tickets/[id]/wallet/apple` → downloads `.pkpass`

Ticket detail UI (`/tickets/[ticketId]`) shows **Add to Google Wallet** / **Add to Apple Wallet** when API checkout is enabled.

## Environment variables (API)

### Google Wallet (JWT save link)

1. Enable [Google Wallet API](https://developers.google.com/wallet) in Google Cloud.
2. Create a service account with Wallet Object Issuer role; download JSON key.
3. Register issuer in [Pay & Wallet Console](https://pay.google.com/business/console) and note **Issuer ID**.

```env
GOOGLE_WALLET_ISSUER_ID=3388000000022XXXXXXXX
GOOGLE_WALLET_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

Alternative (split fields, useful on Vercel):

```env
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=wallet-sa@project.iam.gserviceaccount.com
GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

**Note:** Event ticket classes start as `UNDER_REVIEW` until approved in the Google Wallet console. Test with [demo mode](https://developers.google.com/wallet/generic/test-mode) issuer accounts first.

### Apple Wallet (signed `.pkpass`)

1. Apple Developer → **Identifiers** → Pass Type ID (e.g. `pass.com.allaxs.ticket`).
2. Create **Pass Type ID Certificate**; export `.p12` or PEM cert + key.
3. Download [Apple WWDR G4 certificate](https://www.apple.com/certificateauthority/) (`AppleWWDRCAG4.cer` → PEM).

```env
APPLE_WALLET_PASS_TYPE_IDENTIFIER=pass.com.allaxs.ticket
APPLE_WALLET_TEAM_IDENTIFIER=ABCDE12345
APPLE_WALLET_ORGANIZATION_NAME=All AXS
APPLE_WALLET_WWDR_CERT_PEM=-----BEGIN CERTIFICATE-----...
APPLE_WALLET_SIGNER_CERT_PEM=-----BEGIN CERTIFICATE-----...
APPLE_WALLET_SIGNER_KEY_PEM=-----BEGIN PRIVATE KEY-----...
APPLE_WALLET_SIGNER_KEY_PASSPHRASE=   # if key is encrypted
```

Local dev can use file paths instead of inline PEM:

```env
APPLE_WALLET_WWDR_CERT_PATH=./certs/AppleWWDRCAG4.pem
APPLE_WALLET_SIGNER_CERT_PATH=./certs/signerCert.pem
APPLE_WALLET_SIGNER_KEY_PATH=./certs/signerKey.pem
```

Pass icons reuse `src/assets/brand/logo-mark-white.png` (`npm run sync:brand-assets`).

## Behaviour when not configured

Endpoints return **503** with a message pointing to this doc. UI buttons remain visible; users see an error if they tap before ops configures credentials.

## Implementation notes

- **QR payload:** Same HTTPS verify URL as email PDF attachments — not raw JSON scan payload.
- **Pass content:** Event title, tier, when/where, attendee email, pass ref; sourced via `ticketToPdfContent`.
- **Library:** `passkit-generator` for Apple; `jsonwebtoken` (RS256) for Google save JWT.
- **Security:** Owner-only via existing ticket auth + email backfill for guest purchases.

## Smoke test (after credentials)

```bash
# Replace TOKEN and TICKET_ID
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/tickets/$TICKET_ID/wallet/google"

curl -o ticket.pkpass -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/tickets/$TICKET_ID/wallet/apple"
```

Open the Google `saveUrl` on an Android device signed into Google Pay, or AirDrop/open `.pkpass` on iOS.
