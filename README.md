# NexusForge

NexusForge is a production-oriented monorepo foundation for an AI-powered collaborative software engineering platform.

## Monorepo Structure

- `/apps/web` — Next.js + React + TypeScript + Tailwind frontend
- `/apps/api` — NestJS + TypeScript backend with modular domain services
- `/apps/api/prisma` — Prisma schema for PostgreSQL domain models
- `/.github/workflows/ci.yml` — CI pipeline for lint/test/build
- `/docker-compose.yml` — local infrastructure (PostgreSQL, Redis, MinIO, API, Web)

## Implemented Platform Architecture

### Backend (NestJS)

- Authentication module with JWT access/refresh token endpoints and OAuth-ready provider listing
- Organization, project, board, sprint, task, docs, chat, notification, analytics, integration modules
- Task module demonstrates repository pattern + dependency injection via contract token
- Realtime chat gateway with Socket.IO namespace
- Redis status hook for chat/cache infrastructure validation
- AI module with provider-agnostic selection (`disabled`, `ollama`, `gemini`, `openai-compatible`)
- Storage abstraction module with S3-compatible adapter contract
- Global config + validation + CORS + `/api/health` endpoint

### Data Layer

Prisma schema models include:
- Users, organizations, memberships (RBAC)
- Projects, boards, sprints, tasks
- Documents (Markdown-ready content)
- Chat messages and notifications

### Frontend (Next.js)

- Workspace landing page presenting platform modules
- AI provider visibility
- Markdown rendering preview panel
- Tailwind-powered UI shell ready for shadcn/ui component extension

## Local Development

### Prerequisites

- Node.js 22+
- npm 11+
- Docker + Docker Compose

### Install

```bash
cd /home/runner/work/NexusForge/NexusForge/apps/api && npm install
cd /home/runner/work/NexusForge/NexusForge/apps/web && npm install
```

### Run locally

```bash
# backend
cd /home/runner/work/NexusForge/NexusForge/apps/api && npm run start:dev

# frontend (in another terminal)
cd /home/runner/work/NexusForge/NexusForge/apps/web && npm run dev
```

### Run infrastructure

```bash
docker compose up -d postgres redis minio
```

## Configuration

- API env template: `/apps/api/.env.example`
- Set `AI_PROVIDER` to `disabled | ollama | gemini | openai`

## Quality Gates

- Backend: `npm run lint`, `npm run test`, `npm run build` in `/apps/api`
- Frontend: `npm run lint`, `npm run build` in `/apps/web`

## Notes

This commit establishes a clean-architecture-ready baseline with modular service boundaries and production-oriented infrastructure, ready for deeper feature implementation.
