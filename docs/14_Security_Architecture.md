# Security Architecture

Passwords use bcrypt; access tokens are short-lived and refresh tokens are stored only as hashes. Secrets are environment values and `.env` is ignored. CORS is restricted to the configured web origin. Every tenant query must authorize organization membership before loading data; roles are OWNER, ADMIN, MEMBER, and VIEWER. Production adds secure httpOnly refresh cookies, rate limiting, audit events, CSP, backups, and dependency scanning.
