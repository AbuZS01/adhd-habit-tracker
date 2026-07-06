// Service worker: push + notificationclick only (per PLAN.md section 4/9).
// Runs with elevated origin privileges (E6) — kept deliberately minimal.
// No fetch interception, no caching of API responses, no dynamic code eval.

const DEFAULT_TITLE = 'Habit reminder';
const DEFAULT_BODY = "It's time.";
// Same allowlist logic as src/lib/push.ts (SR-11): the notification payload
// URL is always produced server-side already validated, but the service
// worker re-validates defensively in case a payload is ever malformed.
const ALLOWED_PREFIXES = ['/', '/habits', '/settings'];

function safePath(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return '/';
  }
  const ok = ALLOWED_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?')
  );
  return ok ? url : '/';
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  /** @type {{title?: string, body?: string, url?: string}} */
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  // Title/body arrive already sanitised (plain text, length-capped,
  // control-chars stripped) by src/lib/push.ts before send. The service
  // worker treats them strictly as text — showNotification never
  // interprets them as HTML.
  const title = typeof data.title === 'string' && data.title.length > 0 ? data.title : DEFAULT_TITLE;
  const body = typeof data.body === 'string' && data.body.length > 0 ? data.body : DEFAULT_BODY;
  const url = safePath(data.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
      tag: 'habit-nudge',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(url);
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
