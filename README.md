# NexusForge

NexusForge is a self-hostable collaborative workspace for software teams. It brings projects, Kanban work, team knowledge, chat, and optional AI assistance into a single product without making a hosted AI service a runtime requirement.

> **Status:** Collaboration Core (v0.2.0). NexusForge has a validated production build, secure API foundation, tenant-scoped collaboration resources, audit logging, and a responsive workspace interface. See [docs/PROGRESS_STATUS.txt](docs/PROGRESS_STATUS.txt) for current scope.

## Stack

- **Web:** Next.js, React, Tailwind CSS
- **API:** NestJS, REST, JWT protection, audit logging, rate limiting
- **Data:** PostgreSQL and Prisma
- **Security:** JWT access/refresh tokens, bcrypt password hashes, role-based authorization
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

Open `http://localhost:3000` for the web app and `http://localhost:4000/api/health` for the API health check. The protected API currently covers organizations, projects, tasks, and documents; use a token returned by `/api/auth/register` or `/api/auth/login` as a bearer token.

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
