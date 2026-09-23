# NexusForge

NexusForge is a self-hostable collaborative workspace for software teams. It brings projects, Kanban work, team knowledge, chat, and optional AI assistance into a single product without making a hosted AI service a runtime requirement.

> **Status:** Organizations & RBAC (v0.4.0). NexusForge is now a multi-tenant
> workspace: users create organizations, switch between them, view/update details,
> and manage members with organization-scoped role-based access control (OWNER /
> ADMIN / MEMBER / VIEWER), enforced server-side with strict tenant isolation and
> audit logging. Builds on v0.3.2 (frontend↔backend auth) and v0.3.1 (migrations,
> seed, env validation, refresh-token hardening, CI with PostgreSQL). See
> [docs/PROGRESS_STATUS.txt](docs/PROGRESS_STATUS.txt) for scope.

## Stack

- **Web:** Next.js, React, Tailwind CSS
- **API:** NestJS, REST, JWT protection, audit logging, rate limiting
- **Data:** PostgreSQL and Prisma
- **Security:** JWT access/refresh tokens, refresh-token rotation with reuse detection, SHA-256 refresh-token storage, session revocation, bcrypt password hashes, RBAC primitives, environment validation, Helmet, and rate limiting
- **AI:** optional, provider-agnostic service interface; disabled safely by default

## Quick start

Prerequisites: Node.js 22+, npm 10+, and Docker (for PostgreSQL and Redis).

```bash
cp .env.example .env          # then set JWT secrets (see the file for a generator)
docker compose up -d          # PostgreSQL + Redis
npm install
npm run db:generate           # generate the Prisma client
npm run db:deploy             # apply committed migrations to the database
npm run db:seed               # seed roles and permissions (idempotent)
npm run dev                   # start web + API
```

Open `http://localhost:3000` for the web app and `http://localhost:4000/api/health` for the API health check. Authentication supports email or username login; refresh tokens are delivered in a secure HTTP-only cookie, while the API response contains the short-lived access token.

The API validates its environment at startup and exits with a clear message if a
required variable (for example a JWT secret) is missing or too short. Every
variable is documented in [.env.example](.env.example).

### Database: migrations and seed

- The schema lives in [prisma/schema.prisma](prisma/schema.prisma); committed SQL
  migrations live in `prisma/migrations/`.
- `npm run db:deploy` (`prisma migrate deploy`) applies the committed history to a
  clean database and is the command used in CI and production.
- `npm run db:migrate` (`prisma migrate dev`) is for authoring a **new** migration
  during development after you change the schema.
- `npm run db:seed` inserts the four system roles, the permission catalogue, and
  their grants. It is idempotent — running it repeatedly never creates duplicates.
  An optional local-only user can be enabled via `DEV_SEED_USER_*` (see `.env.example`).

### Continuous integration

The GitHub Actions workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml))
spins up a disposable PostgreSQL service and runs install → Prisma generate →
`migrate deploy` → seed → lint/type-check → tests → production build. It uses only
free, open-source infrastructure and throwaway (non-production) credentials.

## Frontend authentication

The web app talks to the API through a small typed client and a single auth context:

- **API client** (`apps/web/lib/api.ts`): centralizes every request, sends
  `credentials: 'include'`, attaches the access token as `Authorization: Bearer`,
  and on a 401 performs one silent refresh (single-flight) and retries.
- **Endpoint wrappers** (`apps/web/lib/auth.ts`): typed functions for login,
  register, logout, logout-all, `me`, profile update, sessions, revoke, roles.
- **Auth state** (`apps/web/lib/auth-context.tsx`): a `loading → authenticated /
  unauthenticated` machine. On mount it attempts a silent refresh; the access token
  lives **only in memory** and is never written to `localStorage`/`sessionStorage`.
- **Refresh token**: handled entirely by the API's httpOnly, `SameSite=Lax` cookie
  (`nexusforge_refresh`, path `/api/auth`). JavaScript never reads it.
- **Route protection** (`apps/web/components/auth-guard.tsx`): client-side. `Protected`
  redirects unauthenticated users to `/login`; `PublicOnly` sends authenticated users
  away from `/login` and `/register`.

## Organizations & RBAC

NexusForge is multi-tenant: all workspace data lives under an organization, and access
is governed by the caller's **organization role** (OWNER / ADMIN / MEMBER / VIEWER).

Endpoints (all under `JwtAuthGuard`; org routes additionally under `OrgAccessGuard`):

| Method | Path | Required org permission |
| --- | --- | --- |
| GET | `/organizations` | — (your memberships) |
| POST | `/organizations` | — (any authenticated user; you become OWNER) |
| GET | `/organizations/:id` | organization:read |
| PATCH | `/organizations/:id` | organization:update |
| GET | `/organizations/:id/members` | organization:read |
| POST | `/organizations/:id/members` | organization:manage_members |
| PATCH | `/organizations/:id/members/:userId/role` | organization:manage_members |
| DELETE | `/organizations/:id/members/:userId` | membership (self-leave) / manage_members (others) |

Authorization is enforced **server-side**. Non-members get `404` (tenant existence is not
disclosed), an organization always keeps at least one owner, and only owners can grant the
owner role. Member invites use an existing user's email/username (no email subsystem in this
milestone). The frontend adds an org switcher and organization/member pages; the UI hides
controls by role for convenience only. See [ARCHITECTURE.md](ARCHITECTURE.md) for the model.

## Frontend authentication — limitations / future work

Route protection is client-side only — the refresh
cookie belongs to the API origin, so Next.js middleware/SSR cannot validate the JWT.
The real security boundary is the API, which rejects unauthorized requests. A
first-party BFF cookie would enable server-side protection later (see
[ARCHITECTURE.md](ARCHITECTURE.md)). Password recovery and workspace analytics have no
backend yet and are shown as honest "coming soon" placeholders. Because the app runs
credentialed cross-origin requests, the web dev server must stay on **port 3000** to
match the API's `CORS_ORIGIN`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run web and API development servers |
| `npm run build` | Build all workspaces |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint all workspaces |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:deploy` | Apply committed migrations (CI/production) |
| `npm run db:migrate` | Author/apply a development migration |
| `npm run db:seed` | Seed roles and permissions (idempotent) |

## Repository layout

```text
apps/web          Next.js product interface
apps/api          NestJS API and domain modules
packages/shared   Cross-service contracts and types
prisma            PostgreSQL data model
docs              Product, architecture, and operations documentation
```

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the current technical design and [docs/PROGRESS_STATUS.txt](docs/PROGRESS_STATUS.txt) for the delivery roadmap.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
