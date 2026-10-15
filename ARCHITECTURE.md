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

Feature modules own their controllers, DTOs, and services. Organization membership is the tenancy boundary; every project, task, and document operation verifies membership before accessing a record. Global infrastructure includes Prisma, authentication, audit logging, validation, CORS, Helmet, and rate limiting.

Identity uses a short-lived access JWT and a rotating refresh JWT. Each login creates a session with browser, device, IP, login, expiry, and activity data. Refresh tokens are carried in a HTTP-only, same-site cookie and revoked on logout, session revocation, or logout-all. Global roles and permissions are normalized into Role, Permission, UserRole, and RolePermission records; organization membership roles remain the tenant-specific authorization boundary.

AI remains an optional adapter: no core workflow calls an AI provider. Redis is reserved for Socket.IO scaling, queues, caching, and rate-limit storage; local development does not require it.

## Authentication security decisions

- **Refresh-token storage (SHA-256, not bcrypt).** A refresh token is a signed
  JWT far longer than bcrypt's 72-byte input limit, so bcrypt would hash only its
  first 72 bytes and distinct tokens for the same session could collide. Refresh
  tokens are therefore stored as full-length SHA-256 digests and compared in
  constant time. bcrypt (cost 12) is still used for user passwords, which are
  short and benefit from a slow KDF.
- **Refresh-token reuse detection.** Exactly one active refresh token is held per
  session. If a validly signed token is presented whose hash no longer matches the
  current one (a rotated/replayed token), or whose stored record is already
  revoked while the session is still active, the session and its token are revoked,
  an `identity.refresh_reuse_detected` audit event is written, and the request is
  rejected. Only the affected session family is terminated — other sessions are
  untouched.
- **Sanitized responses.** Every auth response that returns a user passes through
  `toPublicUser` (`auth/auth.service.ts`), an explicit field-picker that emits only
  safe fields, so `passwordHash`, roles, and timestamps never reach a response body
  even when a full Prisma row flows through. Refresh tokens stay cookie-only; session
  and role endpoints select safe fields explicitly.
- **Session-bound access tokens.** Every request re-checks the session in the
  database, so a revoked session invalidates its access token immediately.
- **Fail-fast configuration.** The API validates its environment at boot (see
  `apps/api/src/common/env.validation.ts`): required secrets must be present and at
  least 32 characters, and production additionally rejects placeholder or reused
  JWT secrets. Secret values are never included in error output or logs.
- **Abuse throttling.** A global rate limit (100/60s) applies to all routes; the
  credential endpoints (`login`, `register`) add a tighter 10/60s limit. Windows
  roll forward continuously, so no user is ever permanently locked out.

## Database lifecycle

PostgreSQL is provisioned by committed Prisma migrations in `prisma/migrations/`.
`prisma migrate deploy` reproduces the schema on a clean database (used in CI and
production); `prisma migrate dev` authors new migrations during development. The
idempotent seed (`prisma/seed.ts`) establishes the system roles and the permission
catalogue consumed by the RBAC guards.

## Frontend authentication (v0.3.2)

The Next.js app is a real client of the auth API. It uses a browser-SPA-with-refresh-cookie
model — not a BFF — matching the existing backend contract:

```
Browser (web origin :3000)
  fetch(credentials:'include') -- Authorization: Bearer <access, in memory> --> API (:4000)
  - access token: returned in the JSON body, held ONLY in memory (lib/api.ts)
  - refresh token: httpOnly SameSite=Lax cookie on the API origin, JS-invisible
  - on 401 -> single silent POST /api/auth/refresh (cookie) -> rotate -> retry once
```

- **lib/api.ts** — transport: base URL from `NEXT_PUBLIC_API_URL`, credentials included,
  bearer injection, single-flight refresh-and-retry, typed `ApiError` (400/401/403/404/
  409/429/500 mapped to safe messages).
- **lib/auth.ts** — typed wrappers for every auth endpoint (no duplicated fetch logic).
- **lib/auth-context.tsx** — `loading -> authenticated / unauthenticated` state; silent
  refresh on mount; exposes `login`, `register`, `logout`, `logoutAll`, `updateProfile`.
- **components/auth-guard.tsx** — `Protected` / `PublicOnly` client guards.

**Route protection is client-side only.** The refresh cookie is scoped to the API origin,
so Next.js middleware/SSR on the web origin cannot read or validate the JWT — the app does
not claim otherwise. The authoritative boundary remains the API's `JwtAuthGuard`, which
re-checks the session in PostgreSQL on every request. A future **BFF** (Next route handlers
proxying the API behind a first-party httpOnly session cookie) would enable server-side /
middleware protection; it is intentionally out of scope for this milestone. Password reset
and workspace analytics have no backend endpoints yet and are surfaced as honest
placeholders rather than fake functionality.

## Organizations & RBAC (v0.4.0)

Organizations are the multi-tenancy boundary. Every organization-scoped request passes:

```
JwtAuthGuard (identity) -> OrgAccessGuard (membership + org permission) -> service (invariants)
```

**Org-scoped authorization.** The global RBAC guards (`RolesGuard` / `PermissionsGuard`)
check a user's *global* role and are not tenant-aware, so they cannot answer "may this user
update THIS organization". Authorization for organization resources is derived from the
caller's `OrganizationMember.role` (OWNER / ADMIN / MEMBER / VIEWER) — the tenant boundary
the schema already models. `OrgAccessGuard` (`organizations/org-access.ts`) follows the same
Reflector + decorator pattern as `PermissionsGuard`: it resolves the caller's membership for
the `:organizationId` param, attaches it to the request, and checks the required
`@OrgPermissions(...)` against a static role→permission map. It is not a second auth system —
JWT auth, `CurrentUser`, Prisma models, and audit logging are all reused.

Permission map (naming reuses the seed's `organization:*` convention):

| Permission | OWNER | ADMIN | MEMBER | VIEWER |
| --- | :-: | :-: | :-: | :-: |
| organization:read | ✓ | ✓ | ✓ | ✓ |
| organization:update | ✓ | ✓ | | |
| organization:manage_members | ✓ | ✓ | | |

**Isolation (IDOR-safe).** A non-member request for any organization resource returns
**404**, not 403 — the existence of another tenant's org is never disclosed. Authorization is
always explicit and server-side; ID unguessability is never relied upon. Cross-tenant access
is covered by tests (`org-access.spec.ts`) and end-to-end checks.

**Owner-safety invariants** (enforced in `organizations.service.ts`): the creator becomes
OWNER; an organization must always keep at least one owner (last-owner demotion/removal is
rejected); only an OWNER may grant or revoke the OWNER role (blocks admin self-escalation);
managing members requires `organization:manage_members`; a member may remove only themselves
(leave). Important actions emit audit events — `organization.created`, `organization.updated`,
`organization.member_added`, `organization.member_role_changed`, `organization.member_removed`
— with actor, organization, target, and non-sensitive metadata.

**Frontend.** `lib/organizations.ts` wraps the endpoints; an org switcher in the sidebar and
`/organizations` (+`/organizations/[organizationId]`) pages provide create / view / update /
member-management UI. The active organization is the URL segment (no global store). Management
controls are shown per the caller's role for UX only — the backend re-checks every request.

## Projects & Project Membership (v0.5.0)

Projects live inside organizations, forming the hierarchy
`User → Organization → Organization RBAC → Project → Project Membership`. A project
belongs to exactly one organization (`Project.organizationId`, cascade), and project
access never bypasses organization isolation.

**Authorization flow:**

```
JwtAuthGuard -> OrgAccessGuard (org membership + organization:read)
             -> ProjectAccessGuard (project∈org + effective role) -> service (invariants)
```

`ProjectAccessGuard` (`projects/project-access.ts`) loads the project by **both**
`id` and `organizationId` — a project from another org (or a swapped id) is a `404`,
so `projectId` is never trusted alone. It resolves the caller's `ProjectMember` and
computes an **effective project-admin**: an org OWNER/ADMIN has full authority over
every project in their org, OR the caller is an explicit project `ADMIN`.

| Permission | Who |
| --- | --- |
| project:read | any organization member (projects are org-visible) |
| project:update / :delete / :manage_members | effective project-admin (org OWNER/ADMIN or project ADMIN) |

Creating a project is an organization-management action: only org OWNER/ADMIN may create
one, and the creator becomes the project's first `ADMIN`.

**Invariants** (`projects/projects.service.ts`): a project member **must** already be a
member of the parent organization (otherwise `400`); duplicate memberships are rejected by
the `@@unique([userId, projectId])` constraint and an app-level `409`; a plain member may
remove only themselves (leave); deletion is a **soft-delete** (`archivedAt`) that preserves
data, and archived projects are excluded from listings. Audit events: `project.created`,
`project.updated`, `project.archived`, `project.member_added`, `project.member_role_changed`,
`project.member_removed`. Member payloads expose only safe user fields.

**Endpoints** (all under `JwtAuthGuard` + `OrgAccessGuard`; `:projectId` routes also under
`ProjectAccessGuard`): `GET/POST /organizations/:organizationId/projects`,
`GET/PATCH/DELETE /organizations/:organizationId/projects/:projectId`,
`GET/POST .../members`, `PATCH .../members/:userId/role`, `DELETE .../members/:userId`.

**Frontend.** `lib/projects.ts` wraps the endpoints; the organization page lists real
projects, `/organizations/:id/projects` provides list + create, and
`/organizations/:id/projects/:projectId` shows details, members, role management, archive,
and a "Tasks — coming in the next milestone" placeholder. Controls are role-gated for UX only.

## Tasks & Kanban (v0.6.0)

Tasks are project-scoped, extending the hierarchy to
`… → Project → Task (+ comments)`. Task routes reuse the project chain:

```
JwtAuthGuard -> OrgAccessGuard -> ProjectAccessGuard -> service (task∈project check)
```

`ProjectAccessGuard` gained a **project:contribute** level: reading tasks needs only
organization access (`project:read`), while creating/updating/moving/deleting tasks and
posting comments require a contributor — a project ADMIN/MEMBER or an org OWNER/ADMIN, but
**not** a project VIEWER or a plain org member who is not on the project. Management actions
(project settings, membership, archive) still require project-admin.

Every task operation loads the task with `findFirst({ where: { id, projectId } })`, so a task
from another project/tenant is a `404`. An assignee **must** be a member of the project
(`400` otherwise). Comment deletion is restricted to the author or a project admin. Task
payloads expose only safe user fields for assignee/creator. Audit events: `task.created`,
`task.updated`, `task.moved`, `task.deleted`, `task.commented`, `task.comment_deleted`.
The `TaskComment` model (migration `add_task_comments`) cascades on task/author deletion.

**Endpoints:** `GET/POST .../projects/:projectId/tasks` (list supports `status`, `priority`,
`assigneeId` filters), `GET/PATCH/DELETE .../tasks/:taskId`, `PATCH .../tasks/:taskId/move`,
`GET/POST .../tasks/:taskId/comments`, `DELETE .../tasks/:taskId/comments/:commentId`.

**Frontend.** `lib/tasks.ts` wraps the endpoints; a Kanban board
(`/organizations/:id/projects/:projectId/board`) groups tasks into status columns with a
create form and filters. Task moves use a per-card status **select** — a keyboard-accessible
alternative rather than a drag-only workflow. A task detail page edits fields and threads
comments. Contributor controls are gated by effective role for UX only.

## Documents & Knowledge Base (v0.7.0)

Documents are organization-scoped Markdown pages with full revision history. Routes run
under `JwtAuthGuard -> OrgAccessGuard`; reads require `organization:read` (any member) and
writes require `organization:contribute` (a new org permission granted to OWNER/ADMIN/MEMBER
but **not** VIEWER). Every operation loads the document with `findFirst({ where: { id,
organizationId } })`, so a document from another tenant is a `404`.

Each save appends a `DocumentRevision` (migration `add_document_revisions`) capturing the
title, content, and author — so the history is an append-only log and the current content is
the latest revision. Restoring a revision writes its content back and records a new revision.
Updates support **optimistic concurrency**: the client sends the `updatedAt` it loaded, and a
mismatch returns `409` rather than silently overwriting a newer edit. Search (`?q=`) matches
title or content case-insensitively, always scoped to the organization. Audit events:
`document.created`, `document.updated`, `document.deleted`, `document.restored`.

**Endpoints:** `GET/POST /organizations/:organizationId/documents` (list supports `?q=` search),
`GET/PATCH/DELETE .../documents/:documentId`, `GET .../:documentId/revisions`,
`GET .../revisions/:revisionId`, `POST .../revisions/:revisionId/restore`.

**Frontend.** `lib/documents.ts` wraps the endpoints; a knowledge-base list/search page and a
split editor (`/organizations/:id/documents/:documentId`) with live Markdown preview, a
revision list (view/restore), and concurrency-safe save. Markdown is rendered by
`components/markdown.tsx`, which builds React nodes directly (never `dangerouslySetInnerHTML`,
no raw HTML, URLs restricted to http(s)/relative/anchor) — a documented safe subset, not full
CommonMark. Edit controls are gated by role for UX only.
