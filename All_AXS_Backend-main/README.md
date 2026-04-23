# All AXS API

NestJS-based API for the All AXS event ticketing platform with comprehensive authentication, RBAC, and session management.

![CI](https://github.com/YouthPlus/all-axs-api/workflows/API%20CI/badge.svg)

## 🎯 Features

- ✅ **JWT Authentication** with access & refresh tokens
- ✅ **Role-Based Access Control** (ADMIN, ORGANIZER, ATTENDEE)
- ✅ **Session Management** with device fingerprinting
- ✅ **Token Rotation** with reuse attack detection
- ✅ **Redis-Backed Rate Limiting** (distributed)
- ✅ **Email Service** (verification, password reset)
- ✅ **File Upload System** with pluggable storage (Spaces, Local, Stub)
- ✅ **Comprehensive Test Suite** (61 tests, 66%+ coverage)
- ✅ **Type-Safe** with TypeScript
- ✅ **Database Migrations** with TypeORM
- ✅ **CI/CD** with GitHub Actions

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x
- PostgreSQL 14+
- Redis 7+ (optional)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd all-axs-api

# Install dependencies
npm install

# Setup environment
cp env.example .env
# Edit .env with your database credentials

# Create database and enable extensions
createdb all_axs_db
psql -d all_axs_db -c "CREATE EXTENSION citext;"

# Run migrations
npm run migrate:run

# Start development server
npm run start:dev
```

Server will be running at `http://localhost:8080`

**Verify:** `curl http://localhost:8080/health`

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** | Complete local setup guide |
| **[ENV_SETUP.md](ENV_SETUP.md)** | Environment variables reference |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Production deployment guide |
| **[AUTH_GUIDE.md](AUTH_GUIDE.md)** | Authentication system overview |
| **[WEEK2_MONDAY_SUMMARY.md](WEEK2_MONDAY_SUMMARY.md)** | Refresh token implementation |
| **[POSTMAN_TESTING_GUIDE.md](POSTMAN_TESTING_GUIDE.md)** | API testing with Postman |
| **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** | Database migration guide |
| **[CI_SETUP.md](CI_SETUP.md)** | GitHub Actions CI/CD |

---

## 🏗️ Project Structure

```
all-axs-api/
├── src/
│   ├── auth/                 # Authentication & authorization
│   │   ├── decorators/       # @Roles, @Public, @GetUser
│   │   ├── dto/              # Login, Register DTOs
│   │   ├── entities/         # RefreshToken, BlacklistedToken
│   │   ├── guards/           # JwtAuthGuard, RolesGuard
│   │   ├── services/         # Auth, RefreshToken, Email services
│   │   ├── strategies/       # JWT strategy
│   │   └── tasks/            # Token cleanup cron job
│   ├── users/                # User management
│   ├── events/               # Event management
│   ├── domain/               # Shared domain entities
│   ├── database/             # Database config & migrations
│   ├── common/               # Shared utilities
│   └── main.ts               # Application entry point
├── test/                     # E2E tests
├── scripts/                  # Setup scripts
├── .github/workflows/        # CI/CD workflows
└── docs/                     # Documentation (*.md files)
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e

# CI mode (same as GitHub Actions)
npm run test:ci
```

**Test Stats:**
- 8 test suites
- 61 tests
- 66%+ code coverage
- < 2 seconds execution time

---

## 🔐 Authentication Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | Public | Register new user |
| `/auth/login` | POST | Public | Login with credentials |
| `/auth/refresh` | POST | Public | Refresh access token |
| `/auth/me` | GET | Required | Get current user |
| `/auth/logout` | POST | Public | Logout (revoke session) |
| `/auth/logout-all` | POST | Required | Logout all devices |

**Rate Limits:**
- Register: 3 requests/minute
- Login: 5 requests/minute
- Refresh: 10 requests/minute
- Others: 10 requests/minute

---

## 📤 Event Banner Uploads

Event banners can be uploaded using a pluggable storage system supporting:
- **Spaces** (DigitalOcean Spaces, S3-compatible) - Production
- **Local** (File system) - Development
- **Stub** (Disabled) - Testing

### Upload Flow

1. **Initialize Upload** - Get upload URL or direct upload info
   ```bash
   POST /uploads/events/:eventId/banner/init
   Body: { mime: "image/png", size: 1024000 }
   ```

2. **Upload File** (for presigned URLs) - Upload directly to storage
   ```bash
   PUT <uploadUrl>
   Headers: { "Content-Type": "image/png", "Content-Length": "1024000" }
   ```

3. **Direct Upload** (for local storage) - Upload via API
   ```bash
   POST /uploads/events/:eventId/banner/direct
   Content-Type: multipart/form-data
   Body: file (multipart)
   ```

4. **Commit Banner** - Persist banner URL to event
   ```bash
   POST /events/:id/banner/commit
   Body: { url: "https://..." }
   ```

### Storage Drivers

**Spaces (Production):**
- Requires: `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_ACCESS_KEY`, `SPACES_SECRET_KEY`
- Returns presigned URLs for direct upload to Spaces
- Supports CDN via `CDN_BASE_URL`

**Local (Development):**
- Stores files in `uploads/` directory
- Serves files via `/static` endpoint
- Auto-commits banner URL on direct upload

**Stub (Testing):**
- Disables uploads (throws 501)
- Use when uploads are not needed

See storage configuration in `env.example`.

---

## 🗄️ Database

**PostgreSQL** with TypeORM

**Entities:**
- Users (with roles)
- Events
- Tickets & Ticket Types
- Orders & Payments
- Refresh Tokens (session management)
- Blacklisted Tokens
- And more...

**Migrations:**
```bash
npm run migrate:run        # Run pending
npm run migrate:revert     # Revert last
npm run migrate:gen <name> # Generate from entities
```

### DB Selection Rules

The API selects the database connection based on environment:

1. **Test Environment** (`NODE_ENV=test`):
   - If `DATABASE_URL_TEST` is set → uses that URL (must point to `allaxs_test` database)
   - Else → uses `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` variables
   - **Guard**: Requires database name to be exactly `allaxs_test`

2. **Non-Test Environments** (development, production, etc.):
   - Uses `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` variables only
   - **Never uses** `DATABASE_URL_TEST` (even if set)
   - **Guard**: Prevents using database named `allaxs_test`

**Verification:**

```bash
# Development environment
NODE_ENV=development npm run db:fingerprint
# Should show: [DB] connected db=allaxs user=postgres env=development

# Test environment
NODE_ENV=test npm run db:fingerprint
# Should show: [DB] connected db=allaxs_test user=postgres env=test
```

**E2E Test Database:**
- E2E tests use a **persistent** database (`allaxs_test`)
- Database is **not dropped or truncated** between test runs
- Tests clean up their own data via `afterEach`/`afterAll` hooks
- If tests require clean state, they must seed/namespace their own data

**Boot Fingerprint:**
On application start, the API logs:
```
[DB] connected db=<name> user=<role> env=<NODE_ENV>
```

This helps verify the correct database is being used.

---

## 🔄 Redis Integration

**Used for:**
- Distributed rate limiting across API instances
- Future: Caching, real-time features

**Setup:**
```bash
# Docker (recommended)
docker run -d -p 6379:6379 redis:7-alpine

# Homebrew (macOS)
brew install redis && brew services start redis
```

**Configure in .env:**
```env
REDIS_URL=redis://localhost:6379
```

---

## 🛠️ Development Scripts

```bash
# Development
npm run start:dev          # Hot reload
npm run start:debug        # With debugger

# Testing
npm test                   # Unit tests
npm run test:watch         # Watch mode
npm run test:ci            # CI mode with coverage

# Code Quality
npm run lint               # Auto-fix issues
npm run lint:check         # Check only (CI)
npm run typecheck          # TypeScript validation

# Database
npm run migrate:run        # Run migrations
npm run db:setup           # Setup test database

# Build
npm run build              # Production build
npm run start:prod         # Start production
```

---

## 🌐 Environment Variables

### Required

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=all_axs_db
DB_USER=postgres
DB_PASS=postgres

JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Optional

```env
REDIS_URL=redis://localhost:6379  # For distributed rate limiting
SMTP_*                             # For email features
FRONTEND_URL                       # For email links
STORAGE_DRIVER=local               # Storage driver: spaces | local | stub
UPLOAD_MAX_MB=10                   # Max file size for uploads
UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp  # Allowed MIME types
```

See **[ENV_SETUP.md](ENV_SETUP.md)** for complete reference.

---

## 🔒 Security Features

- ✅ **Bcrypt** password hashing
- ✅ **JWT** tokens (access: 15min, refresh: 7 days)
- ✅ **Session-based** refresh tokens with database validation
- ✅ **Token rotation** on every refresh
- ✅ **Reuse detection** with automatic session revocation
- ✅ **Device fingerprinting** (IP, user agent)
- ✅ **Rate limiting** (Redis-backed)
- ✅ **CORS** & **Helmet** security headers
- ✅ **Input validation** with class-validator
- ✅ **SQL injection** protection via TypeORM

---

## 🎓 Getting Started

### 1. Read the Docs

Start with **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** for complete setup instructions.

### 2. Configure Environment

Copy `env.example` to `.env` and update values.

### 3. Run Migrations

```bash
npm run migrate:run
```

### 4. Test the API

Use **[POSTMAN_TESTING_GUIDE.md](POSTMAN_TESTING_GUIDE.md)** for testing endpoints.

### 5. Understand Auth

Read **[AUTH_GUIDE.md](AUTH_GUIDE.md)** and **[WEEK2_MONDAY_SUMMARY.md](WEEK2_MONDAY_SUMMARY.md)**.

---

## 🚢 Deployment

### Vercel (serverless API)

For an API that lives on the same vendor as the Next.js frontend, see **[docs/VERCEL.md](docs/VERCEL.md)** — separate Vercel project, `DATABASE_URL`, migrations, and env wiring to the web app.

### Neon (hosted Postgres)

See **[docs/NEON.md](docs/NEON.md)** — you create the Neon project and set `DATABASE_URL`; the API is already configured to use it.

### GitHub Actions CI

Configured to run on every push/PR:
- ✅ Lint & Type Check
- ✅ Unit & E2E Tests  
- ✅ Build Verification
- ✅ PostgreSQL & Redis Services

### Production Deployment

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for:
- Environment setup
- Database migrations
- Docker deployment
- Security best practices

---

## 📊 API Coverage

**Test Coverage:**
- Statements: 66%+
- Branches: 52%+
- Functions: 46%+
- Lines: 68%+

**Endpoints Tested:**
- Health & Version ✅
- Auth (Register, Login, Refresh) ✅
- User Profile ✅
- Admin Endpoints ✅

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

---

## 📄 License

[UNLICENSED](LICENSE)

---

## 🙏 Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [TypeORM](https://typeorm.io/) - ORM for TypeScript
- [PostgreSQL](https://www.postgresql.org/) - Relational database
- [Redis](https://redis.io/) - In-memory data store
- [Jest](https://jestjs.io/) - Testing framework

---

**All AXS API - Production-Ready Authentication & Event Management** 🎉
