import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Home Education Log',
  description: 'Track each child’s subjects and dated evidence for home education records.',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <nav className="nav no-print" aria-label="Primary">
          <Link href="/">Children</Link>
          {session?.user && <Link href="/family">Family</Link>}
          <span style={{ flex: 1 }} />
          {session?.user && (
            <form
              action={async () => {
                'use server';
                await signOut();
              }}
            >
              <button className="link-btn" type="submit">
                Sign out
              </button>
            </form>
          )}
        </nav>
        {children}
      </body>
    </html>
  );
}
