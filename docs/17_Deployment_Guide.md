# Deployment Guide

1. Set production `DATABASE_URL`, origins, and high-entropy JWT secrets.
2. Build images or run `npm run build`; execute `npm run db:generate` and `prisma migrate deploy`.
3. Deploy API with a persistent database and the web app with `NEXT_PUBLIC_API_URL` pointing at it.
4. Terminate TLS before both services, restrict CORS, and enable database backups.
5. Verify `/api/health`, registration, and a tenant-access smoke test.

Never use `.env.example` values in a public environment.
