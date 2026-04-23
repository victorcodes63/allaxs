# Handoff: Public header + footer on `/events`

## Symptom

`http://localhost:3000/events` appears **without** the full marketing **`SiteHeader`** and **`SiteFooter`**, while guest-facing pages like `/` do show them.

## Root cause (verified)

Chrome is controlled entirely by **`components/layout/AppChrome.tsx`** (client), used from **`app/layout.tsx`** for almost all routes.

Routing logic today:

1. **Hub routes** (`/organizer/*` except onboarding, `/dashboard`, `/dashboard/*`) → **no** `SiteHeader` / `SiteFooter` (intentional app shell).
2. **Public auth routes** (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) → **always** full `SiteHeader` + `SiteFooter`, even if a session exists (`isPublicAuthPath`).
3. **Signed-in user** on any other route → **`LoggedInBrowseChrome`** (slim top bar) + `<main>` only → **`SiteFooter` is never mounted** and **`SiteHeader` is not the marketing header**.
4. **Guest** → full `SiteHeader` + `SiteFooter`.

So if QA is **signed in** while opening `/events`, the current design **by definition** omits the marketing footer and replaces the marketing header with the slim bar. That matches the report “no header and footer” if “header” means the **public** marketing header.

**Not implicated:** `app/events/page.tsx` has no layout that strips chrome; `SiteHeader` does not hide on `/events` when it is rendered.

## Secondary risk (low)

`AppChrome` wraps `AppChromeInner` in **`<Suspense fallback={…}>`** where the fallback is only a `div` + `{children}` **without** header/footer. If `AppChromeInner` ever suspends, users could briefly (or stuck) see chromeless content. Today `useAuth()` does not suspend (effect-based). Worth aligning fallback with real chrome if more hooks are added.

## Product decisions for the assignee

1. **Scope:** Should full marketing chrome (when signed in) apply only to **`/events`** + **`/events/[id]`** + checkout under events, or also to **`/tickets`**, **`/organizers`**, **`/e/[slug]`**, and/or **`/`**?
2. **Hub vs marketing:** Confirm `/dashboard` and `/organizer/*` must **stay** hub shells with no marketing footer.
3. **Duplicate nav:** `SiteHeader` already adapts for signed-in users (e.g. Log out). Using it on `/events` when signed in is consistent with auth pages.

## Implementation direction

Mirror **`isPublicAuthPath`**: introduce something like **`isPublicMarketingCatalogPath(pathname)`** (or a single merged **`usesFullMarketingChrome(pathname)`**) that returns true for:

- `pathname === "/events"` or `pathname.startsWith("/events/")`

Evaluate whether **`/e/[slug]`** (public event vanity URL) should match the same rule.

In **`AppChromeInner`**, evaluate this condition **after** `isHubPath` and **before** `if (user)`, rendering the same wrapper as guests:

```tsx
<div className="flex min-h-dvh flex-col bg-background text-foreground">
  <SiteHeader />
  <main className="flex-1 axs-page-shell py-8 md:py-10">{children}</main>
  <SiteFooter />
</div>
```

Keep the signed-in slim chrome for routes **not** in that allowlist.

## Verification checklist

- [ ] Guest on `/events`: full header + footer (should already pass).
- [ ] **Signed-in** on `/events`: full **`SiteHeader`** + **`SiteFooter`** (the change).
- [ ] Signed-in on `/` (or other browse routes): unchanged unless explicitly added to allowlist.
- [ ] Hub `/dashboard`, `/organizer/dashboard`: still no marketing chrome.
- [ ] `npm run build` passes.

## Files touched (current branch)

- `components/layout/AppChrome.tsx` — `isPublicEventsCatalogPath`, `usesFullMarketingChrome`, and the marketing wrapper applied before the signed-in slim chrome so **`/events` and `/events/*`** always get `SiteHeader` + `SiteFooter`.

## Optional follow-ups

- Align **`AppChrome` Suspense fallback** with marketing chrome skeleton.
- Consider extracting route lists to **`lib/routes/chrome.ts`** to avoid `AppChrome` growing without tests.
