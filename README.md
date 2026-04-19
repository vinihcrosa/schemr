# Schemr

A personal diagram workspace built with Next.js, NextAuth v5, Prisma 7, and PostgreSQL.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Auth | NextAuth v5 (Credentials provider, JWT sessions) |
| Database | PostgreSQL 16 via Docker |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Styling | Tailwind CSS v4 |
| Unit tests | Vitest + React Testing Library |
| Integration tests | Vitest + real Postgres (`schemr_test`) |
| E2E tests | Playwright |

---

## Prerequisites

- Node.js 20+
- Docker Desktop
- yarn

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd schemr
yarn install
```

### 2. Configure environment variables

Copy the example file and fill in your local values:

```bash
cp .env.example .env.local
```

The defaults in `.env.example` work out of the box with the Docker Compose setup:

```env
DATABASE_URL=postgresql://schemr:schemr@localhost:5433/schemr_dev
AUTH_SECRET=dev-secret-change-in-production
AUTH_URL=http://localhost:3000
POSTGRES_USER=schemr
POSTGRES_PASSWORD=schemr
POSTGRES_DB=schemr_dev
TEST_DATABASE_URL=postgresql://schemr:schemr@localhost:5433/schemr_test
```

Generate a secure `AUTH_SECRET` for non-dev environments:

```bash
openssl rand -base64 32
```

### 3. Start the database

```bash
docker compose --env-file .env.local up -d
```

Postgres will be available at `localhost:5433`.

### 4. Generate Prisma client and run migrations

```bash
DATABASE_URL="postgresql://schemr:schemr@localhost:5433/schemr_dev" npx prisma generate
DATABASE_URL="postgresql://schemr:schemr@localhost:5433/schemr_dev" npx prisma migrate dev
```

### 5. Create the test database (for integration tests)

```bash
docker exec schemr-postgres-1 psql -U schemr -d schemr_dev -c "CREATE DATABASE schemr_test;"
DATABASE_URL="postgresql://schemr:schemr@localhost:5433/schemr_test" npx prisma migrate deploy
```

### 6. Start the dev server

```bash
yarn dev
```       

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `/sign-in`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `yarn dev` | Start Next.js dev server |
| `yarn build` | Production build |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |
| `yarn test:unit` | Run unit tests (Vitest, jsdom, no DB) |
| `yarn test:integration` | Run integration tests (Vitest, real Postgres) |
| `yarn test:e2e` | Run E2E tests (Playwright, requires running app) |
| `yarn test` | Run all tests |

### Running integration tests

Integration tests require the test database to be running:

```bash
TEST_DATABASE_URL="postgresql://schemr:schemr@localhost:5433/schemr_test" yarn test:integration
```

### Running E2E tests

E2E tests require Playwright browsers and a built app:

```bash
npx playwright install
TEST_DATABASE_URL="postgresql://schemr:schemr@localhost:5433/schemr_test" yarn test:e2e
```

---

## Project Structure

```text
/
├── app/
│   ├── (auth)/               # Unauthenticated layout + pages
│   │   ├── layout.tsx        # Centered dark layout, redirects if authed
│   │   ├── sign-in/          # Sign-in form (server action + useActionState)
│   │   └── sign-up/          # Sign-up form (fetch to register API)
│   ├── (app)/
│   │   └── page.tsx          # Diagram Index (protected, placeholder)
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/ # NextAuth v5 GET + POST handlers
│       │   └── register/      # Custom POST /api/auth/register
│       └── me/                # GET /api/me — authenticated user from DB
├── auth.ts                   # NextAuth v5 config (Credentials, JWT callbacks)
├── middleware.ts              # Route protection (excludes static + /api/auth)
├── lib/
│   ├── auth.ts               # getSession() + requireSession() helpers
│   └── db.ts                 # Prisma 7 singleton (PrismaPg adapter)
├── types/
│   └── next-auth.d.ts        # Session type augmentation (user.id)
├── prisma/
│   ├── schema.prisma         # User + Diagram models
│   └── migrations/           # Applied migrations
├── prisma.config.ts          # Prisma 7 config (datasource.url + migrate adapter)
├── tests/
│   ├── unit/                 # *.unit.test.tsx — React component tests
│   ├── integration/          # *.integration.test.ts — API route + DB tests
│   ├── e2e/                  # *.spec.ts — Playwright browser tests
│   └── setup/                # Vitest setup files
└── docker-compose.yml        # Postgres 16 on port 5433
```

---

## Auth Flow

1. **Sign up**: `POST /api/auth/register` → Zod validation → bcrypt hash (cost 12) → `db.user.create` → `201`; client then calls `signIn('credentials', ...)`
2. **Sign in**: NextAuth Credentials `authorize()` → find user by email → `bcrypt.compare` → JWT with `token.id = user.id`
3. **Session**: JWT cookie; `session.user.id` typed via `types/next-auth.d.ts` augmentation
4. **Route protection**: `middleware.ts` calls `auth()` on every non-static request; unauthenticated → redirect to `/sign-in`
5. **Server-side auth**: all API routes use `requireSession()` from `lib/auth.ts`; `userId` is always from session, never from request body

---

## Prisma 7 Notes

Prisma 7 removed `url` from the datasource in `schema.prisma`. The connection URL is now configured in `prisma.config.ts`:

```typescript
// prisma.config.ts
export default defineConfig({
  datasource: { url: process.env.DATABASE_URL! },
  migrate: {
    async adapter(env) {
      const { PrismaPg } = await import("@prisma/adapter-pg")
      return new PrismaPg({ connectionString: env.DATABASE_URL })
    },
  },
})
```

All Prisma CLI commands that need a connection must have `DATABASE_URL` set in the environment.

---

## Vercel Deployment

Set the following environment variables in your Vercel project:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Managed Postgres connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | Your Vercel deployment URL |

Push to `main` to trigger automatic deployment.
