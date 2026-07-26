'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Children', icon: '🏠', exact: true },
  { href: '/family', label: 'Family', icon: '👪', exact: false },
];

export default function Sidebar({
  signedIn,
  signOutAction,
}: {
  signedIn: boolean;
  signOutAction?: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar no-print">
      <Link href="/" className="sidebar-logo">
        <span className="sidebar-logo-mark">🏡</span>
        Home Education Log
      </Link>

      {signedIn && (
        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={isActive ? 'active' : ''}>
                <span className="sidebar-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {signedIn && signOutAction && (
        <div className="sidebar-footer">
          <form action={signOutAction}>
            <button className="link-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
