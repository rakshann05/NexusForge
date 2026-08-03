# Frontend Architecture

The Next.js App Router owns routing and server-first rendering. Feature UI belongs in `apps/web/app` and reusable presentational components in `apps/web/components`; API clients and session helpers belong in `apps/web/lib`. Tailwind is the intended component styling layer, with shadcn/ui adopted as components grow. UI never embeds authorization decisions: it renders server-provided capabilities.
