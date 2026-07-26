'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Children', icon: '🏠', exact: true },
  { href: '/family', label: 'Family', icon: '👪', exact: false },
];

const CHILD_SECTIONS = [
  { suffix: '', label: 'Overview', icon: '📋' },
  { suffix: '/planner', label: 'Planner', icon: '📅' },
  { suffix: '/progress', label: 'Progress', icon: '📈' },
  { suffix: '/report', label: 'Evidence report', icon: '📄' },
];

function useCurrentChildId(pathname: string): string | null {
  const match = pathname.match(/^\/children\/([^/]+)/);
  return match ? match[1]! : null;
}

function useChildName(childId: string | null): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) {
      setName(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/children/${childId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setName(body?.child?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return name;
}

export default function Sidebar({
  signedIn,
  signOutAction,
}: {
  signedIn: boolean;
  signOutAction?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const childId = useCurrentChildId(pathname);
  const childName = useChildName(childId);

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

      {signedIn && childId && (
        <div className="sidebar-child-section">
          <p className="sidebar-child-name">{childName ?? 'Loading…'}</p>
          <nav className="sidebar-nav" aria-label="Child">
            {CHILD_SECTIONS.map((section) => {
              const href = `/children/${childId}${section.suffix}`;
              const isActive = pathname === href;
              return (
                <Link key={section.suffix} href={href} className={isActive ? 'active' : ''}>
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    {section.icon}
                  </span>
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </div>
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
