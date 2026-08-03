# API Design

Base path: `/api`. JSON is camelCase; validation rejects unknown fields. Authentication endpoints currently include `POST /auth/register` and `POST /auth/login`; `GET /health` is unauthenticated.

Future resource routes use `/organizations/:organizationId/projects`, `/projects/:projectId/tasks`, and `/organizations/:organizationId/documents`. Resource access must first resolve organization membership, then role policy. Errors use `{ statusCode, message, code? }`.
