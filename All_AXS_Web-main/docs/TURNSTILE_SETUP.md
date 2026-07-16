# Cloudflare Turnstile setup (All AXS)

Turnstile protects **register**, **login**, **forgot password**, and **resend verification** from automated abuse.

## 1. Create the widget (Cloudflare dashboard)

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Click **Add widget manually**.
3. Suggested settings:
   - **Widget name:** `All AXS Auth`
   - **Hostname domains:** add every origin that serves the web app:
     - `axs.africa`
     - `www.axs.africa`
     - `localhost` (local dev)
   - **Widget mode:** **Managed** (recommended — low friction for real users)
4. Copy the **Site key** and **Secret key**.

## 2. Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel (Web) | Renders the widget in the browser |
| `TURNSTILE_SECRET_KEY` | API server (Ubuntu / Vercel backend) | Server-side token verification |

### Vercel (web — axs.africa)

Project → Settings → Environment Variables → **Production** (and Preview if desired):

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
```

Redeploy the web app after saving.

### API (`api.axs.africa`)

Add to the backend `.env` (or host env):

```
TURNSTILE_SECRET_KEY=0x...
```

Restart the API process after saving.

### Local dev

`All_AXS_Web-main/.env.local`:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
```

`All_AXS_Backend-main/.env`:

```
TURNSTILE_SECRET_KEY=0x...
```

Restart `npm run dev` on both after adding keys.

## 3. Behaviour

- When **both** keys are set, register/login/forgot/resend **require** a valid Turnstile token.
- When the **site key** is set but the API secret is missing, the widget still shows but the API skips verification (logs a warning) — set the secret before relying on captcha in production.
- When keys are **missing** locally, checks are skipped entirely. Production web **build fails** if the site key is missing.
- Tokens are single-use and verified via Cloudflare `siteverify`.

## 4. Verify

1. Open `/register` — you should see the Turnstile widget above **Sign Up**.
2. Submit without completing it — expect “Please complete the security check.”
3. Complete the widget and register — request should succeed (or fail on normal validation, not captcha).

## 5. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Widget blank / error | Domain not listed on the Turnstile widget (add `axs.africa` / `localhost`) |
| Widget invisible most of the time | Expected with `appearance: interaction-only` — Cloudflare only shows a challenge when needed; after success the slot collapses |
| Widget invisible / only stuck hint | Ad blocker, domain mismatch, or site key wrong — refresh; confirm hostname on the Turnstile widget |
| Spinner stuck on "Verifying…" | Usually a re-render loop (fixed in `TurnstileField`) or ad blocker / domain mismatch — refresh once; add hostname to widget if prod |
| “Security verification failed” | Site key and secret key are from **different** widgets, or secret not on API |
| Widget missing in prod | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` not set or deploy happened before env save |
| Login works locally, fails in prod | API missing `TURNSTILE_SECRET_KEY` while web has site key |
