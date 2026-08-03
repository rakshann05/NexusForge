# NexusForge

NexusForge is a self-hostable collaborative workspace for software teams. It brings projects, Kanban work, team knowledge, chat, and optional AI assistance into a single product without making a hosted AI service a runtime requirement.

> **Status:** Identity Management (v0.3.0). NexusForge now includes a production-oriented authentication and identity module with session tracking, refresh-token rotation, secure cookie delivery, profile preferences, and role data. See [docs/PROGRESS_STATUS.txt](docs/PROGRESS_STATUS.txt) for current scope.

## Stack

- **Web:** Next.js, React, Tailwind CSS
- **API:** NestJS, REST, JWT protection, audit logging, rate limiting
- **Data:** PostgreSQL and Prisma
- **Security:** JWT access/refresh tokens, session revocation, bcrypt password hashes, RBAC primitives, Helmet, and rate limiting
- **AI:** optional, provider-agnostic service interface; disabled safely by default

## Quick start

Prerequisites: Node.js 22+, npm 10+, and Docker (recommended for PostgreSQL).

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Open `http://localhost:3000` for the web app and `http://localhost:4000/api/health` for the API health check. Authentication supports email or username login; refresh tokens are delivered in a secure HTTP-only cookie, while the API response contains the short-lived access token.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run web and API development servers |
| `npm run build` | Build all workspaces |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint all workspaces |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply a development migration |

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
