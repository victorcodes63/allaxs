# Deploying this app

**Do not run `vercel deploy` from this folder.**

The Vercel project **allaxs** is configured with **Root Directory** = `All_AXS_Web-main` relative to the monorepo. Deploying from inside `All_AXS_Web-main/` causes Vercel to resolve `All_AXS_Web-main/All_AXS_Web-main` and fail.

## Correct deploy (CLI)

From the **monorepo root** (`AllAXS/`):

```bash
./scripts/deploy-web.sh
```

Preview (no `--prod`):

```bash
./scripts/deploy-web.sh --preview
```

Or manually:

```bash
cd "/path/to/AllAXS"
vercel --prod --yes
```

The `.vercel/project.json` link file must live at the **monorepo root**, not here.

## Git push

Pushes to `main` on the umbrella repo still trigger Vercel when the project is connected to GitHub with Root Directory = `All_AXS_Web-main`.

See also [docs/VERCEL.md](./docs/VERCEL.md) for environment variables.
