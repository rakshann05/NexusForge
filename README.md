# NexusForge

NexusForge is a self-hostable collaborative workspace for software teams. It brings projects, Kanban work, team knowledge, chat, and optional AI assistance into a single product without making a hosted AI service a runtime requirement.

> **Status:** Foundation Correctness & Security Hardening (v0.3.1). Builds on the v0.3.0 identity module with a reproducible Prisma migration history, an idempotent seed, fail-fast environment validation, SHA-256 refresh-token storage, refresh-token reuse detection, login throttling, real ESLint, and a CI pipeline that provisions PostgreSQL. See [docs/PROGRESS_STATUS.txt](docs/PROGRESS_STATUS.txt) for current scope.

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
