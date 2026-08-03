# Backend Architecture

NestJS modules are organized by capability: auth, organizations, projects, tasks, documents, realtime, and AI. Controllers validate DTOs; services hold use cases; Prisma is infrastructure behind a single global service initially. Guards and decorators will provide identity and RBAC consistently. Keep cross-module contracts in `@nexusforge/shared` only when both apps genuinely need them.
