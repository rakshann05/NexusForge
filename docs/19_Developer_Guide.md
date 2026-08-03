# Developer Guide

Use Node 20+ and npm workspaces. Copy `.env.example`, start PostgreSQL with `docker compose up -d db`, install dependencies, generate Prisma, migrate, then run `npm run dev`.

Keep changes feature-scoped. Validate external input with DTOs; add service and authorization tests for behavior; avoid direct Prisma queries in controllers. Add migration files for schema changes. Do not commit credentials or generated runtime artifacts. Update `PROGRESS_STATUS.txt` whenever a milestone changes.
