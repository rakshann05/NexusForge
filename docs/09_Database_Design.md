# Database Design

PostgreSQL holds Users, hashed RefreshTokens, Organizations, OrganizationMembers, Projects, ProjectMembers, Tasks, and Documents. Every collaboration record is reached through an organization. Unique membership and organization-scoped project keys prevent duplicates; task status/position indexes support board reads.

Prisma schema is authoritative at [`prisma/schema.prisma`](../prisma/schema.prisma). Migrations, not runtime synchronization, change production structure.
