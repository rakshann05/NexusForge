import ReactMarkdown from 'react-markdown';

const modules = [
  'Authentication & RBAC',
  'Organizations and teams',
  'Workspace projects & kanban',
  'Sprint and task management',
  'Markdown docs',
  'Realtime team chat & notifications',
  'Analytics dashboard',
  'AI assistant and repo integrations',
];

const aiProviders = ['disabled', 'ollama', 'gemini', 'openai-compatible'];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-3xl font-bold">NexusForge Platform</h1>
        <p className="mt-2 text-slate-300">
          Monorepo foundation with Next.js frontend, NestJS backend, Prisma data layer, Redis cache, Socket.IO realtime,
          and provider-agnostic AI architecture.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <article key={module} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">{module}</h2>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">AI Providers</h2>
          <ul className="space-y-1 text-slate-300">
            {aiProviders.map((provider) => (
              <li key={provider}>{provider}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Documentation Preview</h2>
          <div className="prose prose-invert text-sm">
            <ReactMarkdown>
              {`# Team Notes\n- Use sprint rituals\n- Review PRs daily\n- Keep docs updated in markdown`}
            </ReactMarkdown>
          </div>
        </article>
      </section>
    </main>
  );
}
