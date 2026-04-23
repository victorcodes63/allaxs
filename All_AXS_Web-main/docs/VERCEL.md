# Deploy the web app on Vercel

Use a **dedicated Vercel project** for this Next.js repository. The Nest API should be a **second** Vercel project (see `All_AXS_Backend-main/docs/VERCEL.md`).

## One-time setup

1. Vercel → **Add New** → **Project** → import this repo.
2. Framework: **Next.js** (auto-detected). Build: `npm run build`, output default.
3. Add environment variables (Production and Preview as needed):

### Public demo (no API yet)

| Variable                         | Value |
| -------------------------------- | ----- |
| `NEXT_PUBLIC_USE_DEMO_EVENTS`    | `true` |
| `NEXT_PUBLIC_SITE_URL`           | Your production URL, e.g. `https://your-app.vercel.app` |

### Full stack (API on Vercel too)

| Variable                         | Value |
| -------------------------------- | ----- |
| `NEXT_PUBLIC_API_BASE_URL`       | `https://your-api-project.vercel.app` |
| `API_URL`                        | Same as `NEXT_PUBLIC_API_BASE_URL` |
| `NEXT_PUBLIC_SITE_URL`           | This app’s URL (used for metadata and absolute links) |
| `NEXT_PUBLIC_USE_DEMO_EVENTS`    | `false` (or omit; production then uses the API for public events) |

Push to `main` (or your production branch) and Vercel redeploys automatically.

## Preview deployments

Copy the same variables into the **Preview** environment, or use Vercel’s “link to production” for non-secrets. Point preview `API_URL` at a preview API URL if you deploy API previews per branch.

## Notes

- Never use `http://localhost:8080` in Vercel env vars — serverless SSR cannot reach your laptop.
- Auth cookies are set by this app’s `/api/auth/*` routes; keep web and API on HTTPS (Vercel default).
