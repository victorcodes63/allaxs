# Deploy the API on Vercel

The All AXS API is a NestJS app. Vercel runs it as a single serverless function (see [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)). Use a **separate Vercel project** from the Next.js web app, both under the same Vercel team.

## 1. Create the project

1. Vercel → **Add New** → **Project** → import the **backend** Git repository.
2. Framework preset should detect **NestJS** (zero config). Root directory: repository root (where `nest-cli.json` lives).
3. **Build Command:** `npm run build` (already set in `vercel.json`). **`outputDirectory`** is **`public/`** (only a placeholder `.gitkeep` so Vercel’s build output check passes). **Do not** point `outputDirectory` at **`dist/`**: `nest build` writes compiled sources under `dist/src/...`, and Vercel would treat those as static files and shadow the serverless `api/` routes (symptom: `POST /auth/login` returns platform `NOT_FOUND`). The **`api/`** entry is excluded from `nest build` via `tsconfig.build.json` so it is not emitted under `dist/`.
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
git clone https://github.com/victorcodes63/All_AXS_Backend-main.git
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

## 9. Redeploy after API changes

Push to **`main`** on this repository (or run **Redeploy** in the Vercel dashboard) so new routes such as `GET /admin/overview` ship in the serverless bundle.

### Vercel entrypoint

Production on Vercel uses **`api/index.ts`** re-exporting **`src/vercel/nest-serverless.entry.ts`**, with **`vercel.json` rewrites** that send **`/:path*` → `/api?path=:path*`** (not `/api/:path*`). Sending traffic to **`/api/auth/login`** makes Vercel look for a non-existent file like **`api/auth/login.ts`** and return platform **`NOT_FOUND`**. Passing the original path in the **`path`** query parameter keeps every request on **`api/index.ts`**, where the handler strips **`path`** and forwards **`/auth/login`**, **`/health`**, etc. to Nest. **Do not** rewrite to **`/api/:path*`** for this layout. The Vercel project’s **Root Directory** should be **`.`** (the backend repo root).
