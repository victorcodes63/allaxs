# All AXS

Monorepo layout:

| Directory | Description |
|-----------|-------------|
| `All_AXS_Web-main` | Next.js frontend ([docs/VERCEL.md](All_AXS_Web-main/docs/VERCEL.md)) |
| `All_AXS_Backend-main` | NestJS API ([docs/VERCEL.md](All_AXS_Backend-main/docs/VERCEL.md), [docs/NEON.md](All_AXS_Backend-main/docs/NEON.md)) |
| `All_AXS_Infra-main` | Terraform / infrastructure |

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
