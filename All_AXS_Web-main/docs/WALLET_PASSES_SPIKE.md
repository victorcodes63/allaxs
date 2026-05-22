# Wallet passes spike — Apple Wallet & Google Wallet

**Task:** POLISH-016 (spike only)  
**Implementation follow-up:** AUDIT-C3 (`SUBAGENT_MASTER_PLAN.md`)  
**Last updated:** 2026-05-22

---

## Summary

All AXS today delivers tickets as **PDF attachments** (email) and **My tickets** pages. QR codes encode an HTTPS verify URL (`{FRONTEND_URL}/v/{token}`) that decodes to a signed scan payload (`ticketId` + `qrNonce` + HMAC `qrSignature`). Wallet passes should reuse that same QR/verify story so door scanners and `/v/*` landing pages keep working without a second barcode format.

**Recommendation:** Ship **Google Wallet first** (JWT save links, no per-device install of certs on phones), then **Apple Wallet** (PassKit signing + optional push updates). Both are **API-signed**; Web only exposes “Add to Wallet” CTAs and handles redirects.

| Platform | Integration style | Complexity (MVP) |
|----------|-------------------|------------------|
| Google Wallet | Signed JWT → `https://pay.google.com/gp/v/save/{jwt}` | Medium |
| Apple Wallet | Signed `.pkpass` bundle + download / `application/vnd.apple.pkpass` | High |

**Rough estimate (MVP, both platforms, one ticket per order line):** **12–18 engineering days** (1 engineer), plus **1–2 weeks calendar** for Apple/Google onboarding and test devices. Add **3–5 days** if pass push updates on refund/void are required at launch.

---

## Product requirements

### Must have (MVP)

1. **Per-ticket pass** after successful paid checkout (same eligibility as PDF email).
2. **Barcode** on the pass encodes the **same URL** as the PDF QR: `buildTicketQrUrl(FRONTEND_URL, { id, qrNonce, qrSignature })` (see `All_AXS_Backend-main/src/tickets/ticket-qr.util.ts` and `Web/lib/ticket-qr.ts`).
3. **Visible fields:** event title, tier name, attendee name/email (or “Guest”), venue/date lines when present on ticket PDF content, ticket ref (short id), order ref optional.
4. **Entry points:**
   - Order confirmation (API checkout path)
   - My tickets / individual ticket view
   - Ticket email (secondary CTA; PDF remains primary per POLISH-006)
5. **Auth:** Only the ticket owner (or guest with order email proof) can request pass generation; use existing session/JWT patterns.
6. **Void/refund:** When ticket status becomes void/refunded, pass must show **invalid** or be **updated** so scanners reject it (align with `ScanService` HMAC validation).

### Should have (v1.1)

- **Pass updates** without re-download (Apple Push Notification service for PassKit; Google `patch` on object).
- **Localization** (en-KE / en-US) for field labels.
- **Organizer branding** on pass (logo from event/org; depends on POLISH-004 brand asset strategy).

### Out of scope (spike / MVP)

- NFC-only entry, rotating barcodes, or replacing HMAC scan protocol.
- Offline-first wallet without network at scan time.
- WhatsApp delivery of wallet links (see AUDIT-B3 / POLISH-017).
- Multi-ticket **single** pass for whole order (MVP = one pass per `tickets` row).

### Non-functional

- Signing keys and Google service account JSON **only on API** (never `NEXT_PUBLIC_*`).
- Generate passes **on demand** (idempotent per `ticketId` + platform); cache signed artifact optionally (short TTL).
- Rate-limit pass generation per user/ticket (abuse / cost).
- Log issuance; no PII in client-side JWT beyond what Google/Apple display fields require.

---

## Current system (constraints)

| Piece | Location | Notes |
|-------|----------|--------|
| QR URL | API `ticket-qr.util.ts`, Web `lib/ticket-qr.ts` | `/v/{base64url compact v2}` |
| PDF QR | API `TicketPdfService` | Uses `FRONTEND_URL` |
| Scan | API `ScanService` | Validates `qrSignature` over `ticketId:qrNonce` |
| Email | API `EmailService.sendTicketEmail` | PDF attachment via Resend |
| Verify landing | Web `app/v/[token]/page.tsx` | Camera-friendly; organizer auto-verify when signed in |

Wallet work **must not** fork a second scan format unless product explicitly accepts dual scanner logic.

---

## Architecture (target)

```
Buyer UI (Web)
  ├─ "Add to Apple Wallet" → GET /api/tickets/:id/wallet/apple  (or BFF proxy)
  └─ "Add to Google Wallet"  → GET /api/tickets/:id/wallet/google → redirect to pay.google.com/...

API (Nest)
  ├─ WalletPassService
  │    ├─ load ticket + event + order (authorized)
  │    ├─ build pass fields + barcode URL
  │    ├─ Apple: sign .pkpass (pass.json + manifest + signature)
  │    └─ Google: build JWT (genericObject or eventTicketObject)
  ├─ Secrets: Apple cert+key, Google SA JSON, pass type ids
  └─ Webhooks/cron (v1.1): void/refund → push update / patch object

Door scan (unchanged)
  QR on pass → /v/{token} → scan payload → POST .../tickets/scan
```

**Why API-side signing:** Private keys cannot live in Next.js edge/client. Vercel/serverless API (Nest on Vercel/Railway) holds certs and Google credentials.

**Web role:** Buttons, loading states, error copy; optional Next route that proxies download with `Content-Type: application/vnd.apple.pkpass` and `Content-Disposition: attachment`.

---

## Apple Wallet (PassKit)

### Pass type

Use **Event Ticket** (`eventTicket`) style pass ([Apple Pass Kit](https://developer.apple.com/documentation/walletpasses/creating_event_tickets_with_wallet)):

- `pass.json` → `eventTicket` primary/secondary/auxiliary fields
- `barcode` / `barcodes[]`: format `QR`, message = full `buildTicketQrUrl(...)` URL, encoding `iso-8859-1` or UTF-8 per Apple docs
- `logo.png`, `icon.png`, `strip.png` (optional hero) — reuse brand assets from POLISH-004 / `public/brand/`

### Apple Developer setup (one-time)

1. **Apple Developer Program** membership (org account recommended for production).
2. **Identifiers → Pass Type IDs:** create e.g. `pass.com.allaxs.ticket`.
3. **Certificates → Pass Type ID Certificate:** create CSR on secure machine, download `.cer`, import to Keychain, export **`.p12`** (certificate + private key) for the API.
4. Download **Apple WWDR G4** intermediate ([Apple PKI](https://www.apple.com/certificateauthority/)) — required for OpenSSL signing chain.
5. **Optional (updates):** Configure **PassKit Web Service** URL + `authenticationToken` per pass for `registerDevice` / push updates.

### Signing pipeline (server)

1. Build `pass.json` (version, passTypeIdentifier, teamIdentifier, serialNumber = `ticketId`, organizationName, description, relevantDate, locations if venue lat/long available).
2. Add `webServiceURL` + `authenticationToken` only if implementing push updates.
3. Place images in bundle folder.
4. `manifest.json` — SHA1 of each file.
5. Sign manifest with Pass Type ID cert + WWDR → `signature` file.
6. Zip as `.pkpass` (mimetype `application/vnd.apple.pkpass`).

**Node libraries (evaluate in AUDIT-C3):** `passkit-generator` or manual `node-forge` / `openssl` signing. Avoid committing `.p12` to git; store in secret manager.

### Env vars (API)

| Variable | Purpose |
|----------|---------|
| `APPLE_PASS_TYPE_IDENTIFIER` | e.g. `pass.com.allaxs.ticket` |
| `APPLE_TEAM_IDENTIFIER` | 10-char Team ID |
| `APPLE_PASS_CERT_P12_BASE64` | Pass signing cert (or path in non-serverless) |
| `APPLE_PASS_CERT_PASSWORD` | P12 password |
| `APPLE_WWDR_CERT_PEM` | WWDR intermediate PEM |
| `APPLE_PASS_WEB_SERVICE_URL` | (Optional) API base for PassKit web service |
| `APPLE_PASS_AUTH_SECRET` | (Optional) per-pass or global auth token seed |

### Distribution

- **Email / Web:** HTTPS link downloads `.pkpass`; iOS Safari opens Wallet.
- **No App Store app required** for basic add-to-wallet.

### Updates & void

- On refund/void: call PassKit **push** (`POST` to Apple's push gateway with device tokens collected via web service) with updated `pass.json` (`voided: true` or red background + “VOID”).
- Without push: user may keep stale pass — mitigated because **scan still fails** at API via HMAC/status check.

---

## Google Wallet (JWT save link)

### Model choice

Use **Google Wallet API** with a **generic pass** or **event ticket** class:

- **Event ticket** (`eventTicketObjects`) — best semantic fit for concerts/events.
- **Generic** (`genericObjects`) — faster MVP if event-ticket class approval is slow.

Google’s modern flow: create **class** (template) once, create **object** (instance per ticket), expose **Save to Google Wallet** via a **signed JWT**.

### Google Cloud setup (one-time)

1. Google Cloud project with **Google Wallet API** enabled.
2. **Google Pay & Wallet Console** → issuer account / brand.
3. Create **service account** with Wallet Object Issuer role; download JSON key.
4. Register **issuer ID** and define **class** (e.g. `allaxs_event_ticket_v1`).
5. For production: complete Google’s **issuer verification** (can delay go-live).

### JWT approach (recommended for “Add to Google Wallet” button)

1. API builds payload:

```json
{
  "iss": "<service-account-email>",
  "aud": "google",
  "typ": "savetowallet",
  "iat": <unix>,
  "payload": {
    "eventTicketObjects": [
      {
        "id": "<issuerId>.<ticketId>",
        "classId": "<issuerId>.allaxs_event_ticket_v1",
        "state": "ACTIVE",
        "barcode": {
          "type": "QR_CODE",
          "value": "https://<frontend>/v/<token>"
        },
        "ticketHolderName": "...",
        "textModulesData": [ ... ]
      }
    ]
  }
}
```

2. Sign JWT with service account **private key** (`RS256`) using `google-auth-library` or `jsonwebtoken`.
3. Redirect user to `https://pay.google.com/gp/v/save/{signedJwt}`.

**References:** [Google Wallet JWT](https://developers.google.com/wallet/generic/use-cases/jwt), [Event tickets](https://developers.google.com/wallet/tickets/events/use-cases/overview).

### Env vars (API)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_WALLET_ISSUER_ID` | Numeric issuer ID from console |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | Full SA JSON (secret) |
| `GOOGLE_WALLET_CLASS_ID` | e.g. `allaxs_event_ticket_v1` |
| `GOOGLE_WALLET_ENABLE` | Feature flag |

### Updates & void

- `PATCH` object `state` to `INACTIVE` or `EXPIRED` when ticket voided/refunded (REST with SA OAuth).
- JWT save link is one-time add; **updates** require API patch (no user re-click).

---

## API surface (proposed for AUDIT-C3)

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/tickets/:ticketId/wallet/apple` | Owner / order buyer | `.pkpass` binary |
| `GET` | `/tickets/:ticketId/wallet/google` | Owner / order buyer | 302 → `pay.google.com/gp/v/save/...` |
| `POST` | `/internal/tickets/:id/wallet/invalidate` | Admin/cron | Push/patch both platforms |

Web: proxy under `app/api/tickets/[id]/wallet/...` mirroring existing auth proxy pattern, or link directly to API with short-lived signed token.

---

## UX touchpoints (Web)

1. **My tickets** — per-ticket row: Apple + Google buttons (hide when `!qrNonce` demo-only ticket if policy requires).
2. **Order confirmation** — same CTAs under “Open PDF” instructions.
3. **Ticket email** — optional secondary links (do not remove PDF attachment).

Copy example: *“Add to phone wallet for quick access at the door. Your QR works the same as the PDF.”*

---

## Security & compliance

- Pass serial / object id must map 1:1 to `tickets.id` for support and void updates.
- Do not embed `JWT_SECRET` or raw `qrSignature` in pass **text** fields; barcode URL is already public on PDF.
- Google SA JSON and Apple P12 are **tier-0 secrets** (rotation procedure documented in runbook).
- GDPR: wallet adds are user-initiated; Google/Apple process data under their terms.

---

## Dependency on AUDIT-C3

| Item | Relationship |
|------|----------------|
| **POLISH-016** (this doc) | Spike / requirements only — **no code** |
| **AUDIT-C3** | **Implementation** owner: certs, signing, endpoints, void lifecycle, QA on devices |
| **POLISH-007** | PDF parity — wallet **visuals** (logo, colors, field labels) should match PDF layout constants in `ticket-pdf.layout.ts` / `Web/lib/ticket-pdf.ts` |
| **POLISH-002** | Staging smoke — extend checklist with “Add to Wallet” on iOS/Android after AUDIT-C3 |
| **POLISH-004** | Brand assets — pass images should use same bundled/CDN logos as PDF |

**Gate:** Do not start AUDIT-C3 implementation until **POLISH-007** is done or explicitly waived; otherwise pass and PDF will diverge and support burden increases.

**Handoff from spike → AUDIT-C3:**

1. Apple cert + Google issuer provisioned in staging secrets.
2. Implement `WalletPassService` + two GET routes.
3. Feature flag `WALLET_PASSES_ENABLED`.
4. Void/refund hooks call invalidation.
5. Update `STAGING_CHECKLIST.md` and smoke scripts.

---

## Work breakdown & estimate

| Phase | Work | Days |
|-------|------|------|
| 0 | Apple + Google account/certs/issuer (parallel, non-dev) | 3–10 calendar |
| 1 | API: pass builders + secrets + feature flag | 3–4 |
| 2 | Apple `.pkpass` signing + download endpoint | 3–4 |
| 3 | Google class/object + JWT redirect endpoint | 2–3 |
| 4 | Web CTAs + proxy routes + copy | 1–2 |
| 5 | Void/refund sync (Google patch + Apple push **or** document scan-as-source-of-truth) | 2–3 |
| 6 | Device QA (iPhone Safari, Android Chrome) + staging smoke | 2–3 |
| **Total** | MVP both platforms | **12–18 dev days** |

**Risks that add time:** Google issuer approval delay; Apple push infrastructure; serverless binary size limits for signing on Vercel (may need dedicated signer worker or Railway-only route).

---

## Open questions (product)

1. **Demo tickets** (`v1` compact / no `qrNonce`): hide wallet buttons or block with message?
2. **Guest checkout:** wallet links only post-email, or also magic-link with short-lived token?
3. **Transferable tickets:** if introduced later, pass serial strategy may need `transferCount` in object metadata.
4. **Single vs multi QR on one pass** for orders with many tickets — MVP assumes one pass per ticket.

---

## References

- [Apple — Wallet Passes / Event Ticket](https://developer.apple.com/documentation/walletpasses)
- [Apple — PassKit package format](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/Introduction.html)
- [Google Wallet — Save with JWT](https://developers.google.com/wallet/generic/use-cases/jwt)
- [Google Wallet — Event tickets](https://developers.google.com/wallet/tickets/events)
- Internal: `Web/lib/ticket-qr.ts`, `API/src/tickets/ticket-qr.util.ts`, `docs/STAGING_CHECKLIST.md`
