## All AXS Web

Next.js app for All AXS.

### Develop
```bash
npm install
npm run dev
```

### Organizer vs attendee (database)

The API stores **roles** on `users` as a Postgres enum array: `ATTENDEE` (default at registration), `ORGANIZER`, and `ADMIN`. Organizers who use the dashboard also have a row in **`organizer_profiles`**. That is how the product differentiates an event creator from someone who only buys tickets.

**Sign in as an attendee**

- Register at `/register` (or use the seeded demo account from the API `npm run seed:demo` output in `docs/DEMO_ROLES_AND_CHECKOUT.md` on the backend repo).
- Your JWT includes `roles: ["ATTENDEE"]`. Checkout and **My tickets** use the attendee APIs.

**Sign in as an organizer**

- Use the seeded organizer account from `seed:demo`, **or** while signed in as an attendee call **`POST /api/auth/promote-organizer`** (Next proxy) when the API allows it (`ENABLE_PROMOTE_ORGANIZER_ROLE=true` in production, or non-production by default). That adds `ORGANIZER` to `users.roles` and returns fresh cookies.
- Complete **`/organizer/onboarding`** once so **`organizer_profiles`** exists; then **`/organizer/dashboard`** and event management work.

You can hold **both** roles on one user (`ATTENDEE` + `ORGANIZER`) after promotion, or use two separate accounts for a clearer demo.

### Demo attendee journey (signup → demo pay → QR)

1. **Register** at `/register`, then browse **`/events`** (or open an event from the home page).
2. Choose **Continue to checkout** — you must be **signed in**; checkout pre-fills name and email from your session.
3. Select tickets and **Complete demo payment** (no card or live payment processor call; totals are for display only).
4. On the confirmation screen, open **My tickets**, then a pass to view a **real QR code** (JSON payload for scanners in demo mode).

**Storage:** With `NEXT_PUBLIC_USE_API_CHECKOUT=true` (and the API running with demo checkout enabled), orders and tickets are persisted in the database; the app still mirrors a snapshot in **sessionStorage** for the confirmation UI. Without that flag, passes live only in **sessionStorage** until you clear site data.

### Deploy on Vercel

See **[docs/VERCEL.md](docs/VERCEL.md)** for environment variables and how to connect this app to the Nest API (also deployable on Vercel as a second project).

Pushes to `main` trigger a new deployment when this directory is the linked Vercel project root.

### Build
```bash
npm run build && npm run start
```

### Docker
Production image
```bash
docker build -t all-axs-web:prod -f Dockerfile .
docker run --rm -p 3000:3000 all-axs-web:prod
```

Development image
```bash
docker build -t all-axs-web:dev -f Dockerfile.dev .
docker run --rm -it -p 3000:3000 -v $(pwd):/app -v /app/node_modules all-axs-web:dev
```

## Organizer Onboarding

The `/organizer/onboarding` page provides a multi-step wizard for users to set up their organizer profile.

### Flow

1. **First Visit (No Profile):**
   - User navigates to `/organizer/onboarding`
   - Page checks for existing profile via `GET /api/organizer/profile`
   - If no profile exists (404), the wizard is displayed
   - **Step 1:** Organization details (orgName, legalName, website, supportEmail, supportPhone)
   - **Step 2:** Payout details (payoutMethod, bank/MPESA details, taxId, payoutInstructions)

2. **Form Submission:**
   - Validates required fields using Zod schema
   - Calls `POST /api/organizer/profile` with form data
   - On success (200/201), redirects to `/organizer/dashboard`

3. **Subsequent Visits (Profile Exists):**
   - Page checks for existing profile on mount
   - If profile exists (200), automatically redirects to `/organizer/dashboard`
   - Prevents infinite loops using `router.replace()`

### Protection

The onboarding page is protected by middleware (`middleware.ts`):
- Requires authentication (accessToken cookie)
- Unauthenticated users are redirected to `/login` with `next` parameter

### API Integration

The frontend API route handler (`app/api/organizer/profile/route.ts`) proxies requests to the backend:
- **GET:** Forwards to `GET /organizers/profile` with Authorization header
- **POST:** Forwards request body (including `payoutInstructions`) to `POST /organizers/profile`

### Related Files

- **Page:** `app/organizer/onboarding/page.tsx`
- **API Route:** `app/api/organizer/profile/route.ts`
- **Validation:** `lib/validation/organizer.ts`
- **Dashboard:** `app/organizer/dashboard/page.tsx` (redirects to onboarding if no profile)

## Authentication & Protected Routes

### Auth Routes

The application provides the following authentication pages:

- **`/register`** – Create a new account (name, email, password)
- **`/login`** – Sign in with email and password
- **`/forgot-password`** – Request a password reset email
- **`/reset-password?token=...`** – Set a new password using the reset token from email

These pages use Next.js API routes under `/api/auth/...` which proxy to the backend `/auth/...` endpoints. The API routes handle token management (setting HTTP-only cookies for access and refresh tokens).

### Protected Routes

The following path prefixes are protected by `middleware.ts`:

- `/dashboard/*`
- `/organizer/*`
- `/admin/*`
- `/account/*`
- `/tickets/*`

**Behavior:**
- Unauthenticated users are automatically redirected to `/login` with a `next` parameter to return them to the original destination after login.
- After successful login, users can access protected routes based on their roles (handled by the backend).

### High-Level Auth Flow

The authentication flow works as follows:

1. **Frontend pages** (`/login`, `/register`, etc.) collect user input
2. **Next.js API routes** (`/api/auth/login`, `/api/auth/register`, etc.) proxy requests to the backend
3. **Backend** (`/auth/login`, `/auth/register`, etc.) validates credentials and returns tokens
4. **API routes** set HTTP-only cookies for `accessToken` (15 min) and `refreshToken` (7 days)
5. **Protected routes** check for `accessToken` cookie in middleware; if missing or expired, redirect to login

**Password Reset & Email Verification:**
- Password reset and email verification use token links generated by the backend
- The backend sends emails via Resend with links like `/reset-password?token=...` (frontend URL)
- These tokens are validated server-side before allowing password changes

### Related Files

- **Auth Pages:** `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`
- **API Routes:** `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`
- **Validation:** `lib/validation/auth.ts`
- **Middleware:** `middleware.ts`

## Testing

### E2E Tests with Cypress

The project uses Cypress for end-to-end testing.

#### Prerequisites

1. **Backend API Running**
   ```bash
   # In all-axs-api directory
   npm run start:dev
   # API should be on http://localhost:8080
   ```

2. **Frontend Running**
   ```bash
   # In all_axs_web directory
   npm run dev
   # Frontend should be on http://localhost:3000
   ```

3. **Environment Variables**

   Copy [`.env.example`](.env.example) to `.env.local`, or use:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
   API_URL=http://localhost:8080
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_USE_API_CHECKOUT=true
   NEXT_PUBLIC_USE_DEMO_EVENTS=false
   ```

   **Staging / production:** see [`docs/STAGING_CHECKLIST.md`](docs/STAGING_CHECKLIST.md) for Vercel copy-paste blocks and Paystack/Resend alignment with the API project.

   For testing, create `.env.test` or set:
   ```env
   WEB_BASE_URL=http://localhost:3000
   API_URL=http://localhost:8080
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
   ```

   **Note:** 
   - `NEXT_PUBLIC_API_BASE_URL` is used by the frontend API client to call the Nest API directly
   - `API_URL` is used by Next.js API routes (server-side proxies)
   - Set `NEXT_PUBLIC_API_MOCK=1` to enable Next.js proxy routes for ticket types (disabled by default)
   
   The backend must have `ENABLE_TEST_ROUTES=true` or `NODE_ENV=test` to enable test endpoints.

#### Running Tests

```bash
# Open Cypress UI
npm run cypress

# Run headless
npm run cypress:run
```

#### Test Files

- `cypress/e2e/auth-e2e.cy.ts` - Auth happy paths (register, login, protected routes, forgot/reset)
- `cypress/e2e/auth-refresh-rotation.cy.ts` - Refresh token rotation and reuse detection
- `cypress/e2e/rbac-e2e.cy.ts` - Role-based access control tests
- `cypress/e2e/rate-limit-smoke.cy.ts` - Rate limiting smoke tests

#### Custom Commands

See `cypress/support/commands.ts` for available custom commands:

- `cy.apiLogin(email, password)` - Login via API route
- `cy.apiRegister(email, password, name)` - Register via API route
- `cy.clearAuth()` - Clear authentication
- `cy.seedUser(email, password, options?)` - Seed test user
- `cy.getLatestTokens(email)` - Get verification/reset tokens
- `cy.getLatestAuditLog()` - Get latest audit log

For detailed testing documentation, see the backend `QA_E2E.md` file.

## API Client

The application uses a shared API client (`lib/api-client.ts`) for making direct calls to the NestJS backend.

### Usage

```typescript
import { apiClient } from "@/lib/api-client";

// GET request
const response = await apiClient.get("/events/:id/ticket-types");

// POST request
await apiClient.post("/events/:id/ticket-types", payload);

// PATCH request
await apiClient.patch("/ticket-types/:id", payload);

// DELETE request
await apiClient.delete("/ticket-types/:id");
```

### Configuration

- **Base URL**: Set via `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8080`)
- **Authentication**: Automatically includes Bearer token from httpOnly cookie via `/api/auth/token` endpoint
- **Error Handling**: Automatically handles 401 errors and token refresh
- **CORS**: Includes credentials for cookie-based authentication

### Next.js API Routes

Next.js API routes (`app/api/**`) are kept for:
- Authentication endpoints (login, register, refresh) - these set httpOnly cookies
- Minimal token proxy (`/api/auth/token`) - returns token for client-side API calls
- Backward compatibility/mocking - ticket type routes return 501 unless `NEXT_PUBLIC_API_MOCK=1`

**Important**: Frontend components should use the API client to call the Nest API directly, not Next.js proxy routes.

## Event Editor

The Event Editor allows organizers to create, edit, and manage their events through a user-friendly interface.

### Quick Start

1. **Complete Organizer Onboarding**
   - Navigate to `/organizer/onboarding`
   - Fill in your organizer profile details
   - You'll be redirected to the dashboard

2. **Create an Event** (via API - UI coming soon)
   - Use the API to create an event: `POST /events`
   - Save the event ID from the response

3. **Navigate to Event Editor**
   - Go to: `/organizer/events/[eventId]/edit`
   - Replace `[eventId]` with your event ID

### Features

- **Details Tab:** Edit event title, type, venue, dates, description
- **Media Tab:** Upload and manage event banner images
- **Ticket Tiers Tab:** Manage ticket types (create, update, delete, list) - calls Nest API directly

### Status-Based Editing

- **DRAFT:** Fully editable, can submit for review
- **PENDING_REVIEW:** Editable, cannot submit for review
- **PUBLISHED:** Read-only, cannot edit

### Documentation

For detailed navigation instructions, API usage, and troubleshooting, see:
- **`EVENT_EDITOR_NAVIGATION_GUIDE.md`** - Complete guide for manual navigation and testing

### Related Files

- **Page:** `app/organizer/events/[id]/edit/page.tsx`
- **Components:** `components/organizer/event-editor/`
- **API Routes:** `app/api/events/`, `app/api/uploads/`
- **Validation:** `lib/validation/event.ts`
