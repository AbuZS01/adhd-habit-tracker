import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Lora } from 'next/font/google';
import { auth, signOut } from '@/lib/auth';
import AppNav from '@/components/AppNav';
import './globals.css';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Home Education Log',
  description: 'Track each child’s subjects and dated evidence for home education records.',
};

export const viewport: Viewport = {
  themeColor: '#f3f2f2',
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
    <html lang="en" className={`${cormorantGaramond.variable} ${lora.variable}`}>
      <body>
        <div className="app-shell">
          <AppNav signedIn={signedIn} signOutAction={signedIn ? signOutAction : undefined} />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
