# System Architecture

```mermaid
flowchart LR
  Browser[Next.js web] -->|HTTPS / WebSocket| API[NestJS API]
  API --> Prisma[Prisma]
  Prisma --> DB[(PostgreSQL)]
  API --> Store[Storage adapter]
  API -. optional .-> AI[AI provider adapter]
```

Controllers translate transport input to application services. Domain services enforce authorization and workflows. Adapters own database, sockets, files, and AI provider details.
