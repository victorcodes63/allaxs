# Deploy the web app on Vercel

Use a **dedicated Vercel project** for this Next.js app. The Nest API lives in a **separate** GitHub repository and should be its **own** Vercel project:

**Backend:** [github.com/victorcodes63/All_AXS_Backend-main](https://github.com/victorcodes63/All_AXS_Backend-main) — see that repo’s `docs/VERCEL.md` for API env vars, `api/[[...segments]].ts`, and production checks.

## Repositories (not a monorepo)

| Piece | GitHub | Vercel |
| ----- | ------ | ------ |
| **Web** (this app) | The repo you imported for `allaxs` (e.g. `victorcodes63/allaxs`) | One project — **Root Directory** = the folder that contains this app’s `package.json` and `app/` (often `.` at the repo root). |
| **API** | [victorcodes63/All_AXS_Backend-main](https://github.com/victorcodes63/All_AXS_Backend-main) | A **second** project — root should be the **backend** repo root (where `nest-cli.json`, `package.json`, and `api/[[...segments]].ts` live). |

Point `API_URL` and `NEXT_PUBLIC_API_BASE_URL` at the **production URL** of the API project (e.g. `https://all-axs-backend-main.vercel.app`), not a team preview URL that requires SSO unless you intend that.

## One-time setup (web)

1. Vercel → **Add New** → **Project** → import **this** web repository.
2. **Root Directory:** leave as `.` if the Next app is at the repo root; otherwise select the subdirectory that contains `package.json` and `app/`.
3. Framework: **Next.js** (auto-detected). Build: `npm run build`, output default.
4. Add environment variables (Production and Preview as needed):

### Public demo (no API yet)

| Variable                         | Value |
| -------------------------------- | ----- |
| `NEXT_PUBLIC_USE_DEMO_EVENTS`    | `true` |
| `NEXT_PUBLIC_SITE_URL`           | Your production URL, e.g. `https://your-app.vercel.app` |

Do **not** set `NEXT_PUBLIC_USE_API_CHECKOUT=true` with demo events — checkout needs real event UUIDs from the API.

### Full stack (API on Vercel too)

| Variable                         | Value |
| -------------------------------- | ----- |
| `NEXT_PUBLIC_API_BASE_URL`       | `https://your-api-project.vercel.app` |
| `API_URL`                        | Same as `NEXT_PUBLIC_API_BASE_URL` |
| `NEXT_PUBLIC_SITE_URL`           | This app’s URL (used for metadata and absolute links; must match API `FRONTEND_URL`) |
| `NEXT_PUBLIC_USE_DEMO_EVENTS`    | `false` (or omit; production then uses the API for public events) |
| `NEXT_PUBLIC_USE_API_CHECKOUT`   | `true` for Paystack + persisted orders/tickets |

**Staging / go-live:** start with **[PHASE0_GO_LIVE.md](./PHASE0_GO_LIVE.md)**, then **[STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md)**. Production builds **fail** if `NEXT_PUBLIC_USE_DEMO_EVENTS=true` on Vercel Production. API Paystack, Resend, and `FRONTEND_URL` live on the **backend** Vercel project.

Push to `main` (or your production branch) and Vercel redeploys automatically.

## Preview deployments

Copy the same variables into the **Preview** environment, or use Vercel’s “link to production” for non-secrets. Point preview `API_URL` at a preview API URL if you deploy API previews per branch.

## Notes

- Never use `http://localhost:8080` in Vercel env vars — serverless SSR cannot reach your laptop.
- Auth cookies are set by this app’s `/api/auth/*` routes; keep web and API on HTTPS (Vercel default).
