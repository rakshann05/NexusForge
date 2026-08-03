# Software Requirements Specification

The web client is a Next.js application served separately from a NestJS JSON API. PostgreSQL is the system of record through Prisma. API requests authenticate with short-lived JWTs; refresh credentials are stored hashed and can be revoked.

Functional requirements: registration and login; organization membership; project and task CRUD; ordered task states; document CRUD; realtime event delivery; role checks; dashboard aggregates. Quality requirements: input validation, structured errors, tenant-scoped queries, testable services, and environment-only secrets.
