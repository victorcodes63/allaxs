# All AXS

This clone keeps **web**, **API**, and **infra** folders side by side. On GitHub they are separate repositories: the Next app and this umbrella repo are typically [`victorcodes63/allaxs`](https://github.com/victorcodes63/allaxs); the Nest API lives in [`victorcodes63/All_AXS_Backend-main`](https://github.com/victorcodes63/All_AXS_Backend-main).

| Directory | Description |
|-----------|-------------|
| `All_AXS_Web-main` | Next.js frontend ([docs/VERCEL.md](All_AXS_Web-main/docs/VERCEL.md)) |
| `All_AXS_Backend-main` | NestJS API ([docs/VERCEL.md](All_AXS_Backend-main/docs/VERCEL.md), [docs/NEON.md](All_AXS_Backend-main/docs/NEON.md)) |
| `All_AXS_Infra-main` | Terraform / infrastructure |

## Push API changes to the backend repository

After you commit backend work under `All_AXS_Backend-main/` in **this** repo, sync it to the standalone backend remote:

```bash
cd "/Users/victorchumo/Desktop/Raven Tech Group/AllAXS"
./scripts/push-backend-to-github.sh
```

The script adds a `backend` remote if needed and uses `git subtree split` to push `All_AXS_Backend-main/` to `main` on [`All_AXS_Backend-main`](https://github.com/victorcodes63/All_AXS_Backend-main).

If the first push is rejected (unrelated histories), run once:

```bash
BACKEND_PUSH_FORCE=1 ./scripts/push-backend-to-github.sh
```

Override defaults if needed: `BACKEND_REMOTE`, `BACKEND_URL`.

**Optional — run automatically on `git push`:** when commits you are pushing touch `All_AXS_Backend-main/`, the pre-push hook mirrors that subtree to the backend repo (same as the script above). Enable once per clone:

```bash
git config core.hooksPath .githooks
```

Pushes to the `backend` remote are skipped by the hook (stdin is drained first so nested `git push backend` from the subtree script never hangs).

## Local development

- **Web:** `cd All_AXS_Web-main && npm install && npm run dev`
- **API:** `cd All_AXS_Backend-main` — copy env from team vault; `npm install && npm run start:dev`

Do not commit `.env` files; they are gitignored at the repo root.

## Push to a new remote

Create an empty repository on GitHub (or GitLab), then:

```bash
cd "/Users/victorchumo/Desktop/Raven Tech Group/AllAXS"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```
