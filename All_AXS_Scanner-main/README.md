# All AXS Scanner PWA

A lightweight, standalone door-scanning PWA for event check-in.

## Setup

```bash
cp .env.example .env
# Edit VITE_API_BASE_URL to point to your backend
npm install
npm run dev        # starts on http://localhost:3001
```

## Opening the scanner

Volunteers receive a link like:

```
https://scanner.axs.africa/s/<64-hex-token>
```

Also supported for local testing:

- Path: `/s/<64-hex-token>` (production format from the API)
- Query: `?session=<64-hex-token>`
- Hash: `#/s/<64-hex-token>`

Opening the link loads the scanner directly — no login required.

Ticket QRs encode verify URLs such as `https://www.axs.africa/v/...`. The scanner decodes those URLs before calling the API.

## Architecture

- **Single page**, state-machine driven (`useReducer`)
- **No routing library** — session token parsed from path, hash, or query on load
- **jsQR** decodes QR frames from the rear camera at ~10 fps
- **Zero PII** flows to this app — responses only contain first name and ticket tier

## States

| State | Description |
|---|---|
| `LOADING_SESSION` | Fetching session info from backend |
| `READY` | Camera live, scanning |
| `RESULT_VALID` | Green ✓ — auto-returns to READY after 2.5s |
| `RESULT_INVALID` | Red ✗ — auto-returns to READY after 2.5s |
| `ERROR` | Unrecoverable (bad/expired link) |

## Build & deploy

```bash
npm run build      # outputs to dist/
npm run preview    # preview production build
```

Deploy `dist/` as a static site (e.g. `scanner.axs.africa` on Vercel).

Production env:

```env
VITE_API_BASE_URL=https://<your-api-host>
```

On the API project, set `SCANNER_APP_URL=https://scanner.axs.africa` so volunteer invite links point here.
