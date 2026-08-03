# NexusForge Architecture

NexusForge is a modular TypeScript monorepo. The Next.js client owns presentation and session-aware navigation. The NestJS API exposes a versionable REST boundary, validates DTOs, resolves identity from short-lived bearer tokens, and delegates use cases to feature services. PostgreSQL is the system of record, accessed only through Prisma.

```mermaid
flowchart LR
  W[Next.js web] -->|REST / Socket.IO| A[NestJS API]
  A --> G[JWT + RBAC guards]
  A --> P[Feature services]
  P --> D[(PostgreSQL / Prisma)]
  P --> L[Audit log]
  A -. optional .-> I[AI provider adapter]
  A -. future .-> R[Redis]
```

Feature modules own their controllers, DTOs, and services. Organization membership is the tenancy boundary; every project, task, and document operation verifies membership before accessing a record. Global infrastructure includes Prisma, authentication, audit logging, validation, CORS, Helmet, and rate limiting (wired next as a dedicated global guard).

AI remains an optional adapter: no core workflow calls an AI provider. Redis is reserved for Socket.IO scaling, queues, caching, and rate-limit storage; local development does not require it.
