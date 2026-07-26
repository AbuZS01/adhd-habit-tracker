import type { Metadata, Viewport } from 'next';
import { auth, signOut } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Home Education Log',
  description: 'Track each child’s subjects and dated evidence for home education records.',
};

export const viewport: Viewport = {
  themeColor: '#f4f5fb',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  async function signOutAction() {
    'use server';
    await signOut();
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar signedIn={signedIn} signOutAction={signedIn ? signOutAction : undefined} />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
