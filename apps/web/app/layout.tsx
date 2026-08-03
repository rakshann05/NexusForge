import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexusForge',
  description: 'AI-powered collaborative software engineering platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
