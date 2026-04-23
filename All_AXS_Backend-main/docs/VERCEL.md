# Deploy the API on Vercel

The All AXS API is a NestJS app. Vercel runs it as a single serverless function (see [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)). Use a **separate Vercel project** from the Next.js web app, both under the same Vercel team.

## 1. Create the project

1. Vercel → **Add New** → **Project** → import the **backend** Git repository.
2. Framework preset should detect **NestJS** (zero config). Root directory: repository root (where `nest-cli.json` lives).
3. **Build Command:** `npm run build` (already set in `vercel.json`).
4. Deploy once; it will fail until environment variables are set — that is expected.

## 2. Postgres (required)

Serverless functions need a **network** Postgres instance, not `localhost`.

We standardize on **Neon** for now: follow **[NEON.md](./NEON.md)** (you create the project; set `DATABASE_URL` in Vercel and run migrations once from your laptop).

- In Vercel → API project → **Settings → Environment Variables** add:

| Variable         | Example / notes                                      |
| ---------------- | ---------------------------------------------------- |
| `DATABASE_URL`   | Full Postgres URL (SSL usually required in prod)   |
| `NODE_ENV`       | `production`                                         |

Run migrations against that database **once** from your machine (or a CI job), with the same `DATABASE_URL`:

```bash
cd All_AXS_Backend-main
export DATABASE_URL="postgres://..."
export NODE_ENV=production
npm ci
npm run migrate:run
```

Alternatively use Vercel’s “Postgres” storage and run migrations via `vercel env pull` then local `npm run migrate:run`.

## 3. Auth and app URLs

| Variable               | Required | Notes |
| ---------------------- | -------- | ----- |
| `JWT_SECRET`           | Yes      | Strong random string |
| `JWT_REFRESH_SECRET`   | Yes      | Different strong random string |
| `FRONTEND_URL`         | Yes      | **Web** deployment URL, e.g. `https://your-web.vercel.app` (password-reset / verify links) |

## 4. Email (optional for demos)

Default provider is Resend and requires `RESEND_API_KEY` and `RESEND_FROM` in production.

For a **demo without mail**, set:

```env
EMAIL_PROVIDER=none
```

(Any value other than `resend` disables sending; registration still works if the product flow does not require email verification in your setup.)

## 5. Redis (optional)

Rate limiting uses Redis when `REDIS_URL` is set. If omitted, the app falls back to in-memory throttling (fine for early demos).

## 6. File uploads on Vercel

Do **not** use `STORAGE_DRIVER=local` on Vercel (ephemeral disk). Use:

- `STORAGE_DRIVER=stub` — uploads disabled (fine for demos), or  
- `STORAGE_DRIVER=spaces` — DigitalOcean Spaces / S3-compatible + the `SPACES_*` variables (see main README).

## 7. Wire the web app

In the **Web** Vercel project, set:

- `NEXT_PUBLIC_API_BASE_URL` = `https://<your-api-project>.vercel.app`
- `API_URL` = same URL

Then set `NEXT_PUBLIC_USE_DEMO_EVENTS=false` if you want listings to come from the API.

## 8. Limitations

- **Scheduled jobs** (e.g. token cleanup cron) do not run on a fixed schedule unless you add [Vercel Cron](https://vercel.com/docs/cron-jobs) hitting a secured route.
- Cold starts apply; acceptable for a new platform.
- Function bundle size limit (see Vercel docs).

## Local parity

Use `vercel dev` from this repo (Vercel CLI ≥ 48.4) to approximate production locally.
