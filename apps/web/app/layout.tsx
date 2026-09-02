import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';
export const metadata: Metadata = { title: 'NexusForge', description: 'Collaborative engineering workspace' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
