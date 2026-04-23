# Neon Postgres (you create it; app is already wired)

The API reads **`DATABASE_URL`** when set (see `src/database/typeorm-config.factory.ts`). Nothing else is required in code beyond that env var.

## What you do (about 5 minutes)

### 1. Create a Neon project

1. Sign up at [https://neon.tech](https://neon.tech).
2. **Create project** → pick a region close to your users (or to Vercel’s region if the API runs on Vercel).
3. Open your project → **Dashboard** → **Connection details**.

### 2. Pick the right connection string

- **For Vercel (serverless API):** use the **pooled** connection string if Neon shows both *pooled* and *direct* (pooling reduces connection churn from short-lived functions).
- Copy the full URI (it usually includes `sslmode=require`).

### 3. Store it as `DATABASE_URL`

**Local `.env` (never commit):**

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
NODE_ENV=development
JWT_SECRET=...generate-a-long-random-string...
JWT_REFRESH_SECRET=...another-long-random-string...
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=none
```

**Vercel (API project):** Settings → Environment Variables → add `DATABASE_URL` with the same value (and the other vars your `validateEnv` / deploy need: JWT secrets, `FRONTEND_URL`, etc. — see [VERCEL.md](./VERCEL.md)).

### 4. Run migrations once against Neon

From `All_AXS_Backend-main` on your machine, with `DATABASE_URL` in `.env` (or exported):

```bash
export DATABASE_URL="postgresql://..."
export NODE_ENV=development
npm ci
npm run migrate:run
```

The TypeORM CLI (`src/database/data-source.factory.ts`) reads **`DATABASE_URL`** the same way as the Nest app. Use the **same** `DATABASE_URL` in Vercel so the schema matches.

### 5. Smoke test

```bash
npm run start:dev
curl http://localhost:8080/health
```

---

## What we already did in code

- TypeORM uses **`DATABASE_URL`** when not in `NODE_ENV=test`.
- **TLS** is enabled automatically for non-localhost URLs (required for Neon).

## What you do not need for Neon

- Separate `DB_HOST` / `DB_USER` / … if you only set `DATABASE_URL` (validation allows that path).

If you want, paste a **redacted** connection string shape (host only, no password) in chat and we can double-check pooler vs direct for your Vercel setup.
