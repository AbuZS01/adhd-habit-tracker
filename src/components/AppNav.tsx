'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, Calendar, FileText, Users, ClipboardList, LineChart } from 'lucide-react';

const DRAWER_NAV_ITEMS = [
  { href: '/', label: 'Children', Icon: Home, exact: true },
  { href: '/family', label: 'Family', Icon: Users, exact: false },
];

const CHILD_SECTIONS = [
  { suffix: '', label: 'Overview', Icon: ClipboardList },
  { suffix: '/planner', label: 'Planner', Icon: Calendar },
  { suffix: '/progress', label: 'Progress', Icon: LineChart },
  { suffix: '/report', label: 'Evidence report', Icon: FileText },
];

// The bottom tab bar's Planner/Evidence-report destinations are per-child,
// but the tab bar itself is global — so it needs a "current child" even on
// screens with no child in the URL (e.g. the dashboard). We track the last
// child visited in localStorage and fall back to that.
const LAST_CHILD_KEY = 'lastChildId';

const TAB_ITEMS = [
  { key: 'children', label: 'Children', Icon: Home, href: () => '/' },
  { key: 'planner', label: 'Planner', Icon: Calendar, href: (childId: string | null) => (childId ? `/children/${childId}/planner` : '/') },
  { key: 'report', label: 'Evidence', Icon: FileText, href: (childId: string | null) => (childId ? `/children/${childId}/report` : '/') },
  { key: 'family', label: 'Family', Icon: Users, href: () => '/family' },
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

// Remembers the last child whose route was visited, so the bottom tab bar's
// Planner/Evidence-report tabs still go somewhere useful from the dashboard.
function useLastChildId(currentChildId: string | null): string | null {
  const [lastChildId, setLastChildId] = useState<string | null>(currentChildId);

  useEffect(() => {
    if (currentChildId) {
      setLastChildId(currentChildId);
      try {
        window.localStorage.setItem(LAST_CHILD_KEY, currentChildId);
      } catch {
        // Private browsing / storage disabled — the tab bar just falls back to '/'.
      }
      return;
    }
    try {
      const stored = window.localStorage.getItem(LAST_CHILD_KEY);
      if (stored) setLastChildId(stored);
    } catch {
      // ignore
    }
  }, [currentChildId]);

  return lastChildId;
}

export default function AppNav({
  signedIn,
  signOutAction,
}: {
  signedIn: boolean;
  signOutAction?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const childId = useCurrentChildId(pathname);
  const childName = useChildName(childId);
  const tabChildId = useLastChildId(childId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header className="topbar no-print">
        {signedIn && (
          <button className="topbar-menu-btn" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <Link href="/" className="topbar-logo">
          Home Education Log
        </Link>
      </header>

      {signedIn && (
        <>
          <div className={`scrim nav-drawer-scrim${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
          <aside className={`nav-drawer no-print${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
            <div className="nav-drawer-head">
              <span className="nav-drawer-title">Menu</span>
              <button className="nav-drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <nav className="nav-drawer-nav" aria-label="Primary">
              {DRAWER_NAV_ITEMS.map(({ href, label, Icon, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link key={href} href={href} className={isActive ? 'active' : ''}>
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {childId && (
              <div className="nav-drawer-child-section">
                <p className="nav-drawer-child-name">{childName ?? 'Loading…'}</p>
                <nav className="nav-drawer-nav" aria-label="Child">
                  {CHILD_SECTIONS.map(({ suffix, label, Icon }) => {
                    const href = `/children/${childId}${suffix}`;
                    const isActive = pathname === href;
                    return (
                      <Link key={suffix} href={href} className={isActive ? 'active' : ''}>
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                        {label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {signOutAction && (
              <div className="nav-drawer-footer">
                <form action={signOutAction}>
                  <button className="link-btn" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </aside>
        </>
      )}

      {signedIn && (
        <nav className="bottom-tab-bar no-print" aria-label="Primary">
          {TAB_ITEMS.map(({ key, label, Icon, href }) => {
            const resolvedHref = href(tabChildId);
            const isActive =
              key === 'children'
                ? pathname === '/'
                : key === 'family'
                  ? pathname.startsWith('/family')
                  : pathname === resolvedHref;
            return (
              <Link key={key} href={resolvedHref} className={isActive ? 'active' : ''}>
                <Icon size={21} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
