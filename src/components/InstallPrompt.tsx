'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, subscribeToPush } from '@/sw/register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Guides installation (required precondition for push on iOS — see
 * PLAN.md section 10) and, once installed, offers to enable notifications.
 */
export default function InstallPrompt({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'enabled' | 'unsupported'>('idle');

  useEffect(() => {
    registerServiceWorker();

    if (isIos() && !isStandalone()) {
      setShowIosHint(true);
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  async function handleEnableNotifications() {
    if (!('Notification' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    const ok = await subscribeToPush(vapidPublicKey);
    setNotifStatus(ok ? 'enabled' : 'unsupported');
  }

  if (dismissed) return null;
  if (!deferredPrompt && !showIosHint && notifStatus !== 'idle') return null;

  return (
    <div className="install-banner">
      <div>
        {deferredPrompt && <p style={{ margin: 0 }}>Install this app for reliable reminders.</p>}
        {showIosHint && (
          <p style={{ margin: 0 }}>
            On iPhone: tap Share, then &quot;Add to Home Screen&quot; to enable reminders.
          </p>
        )}
        {!deferredPrompt && !showIosHint && (
          <p style={{ margin: 0 }}>
            {notifStatus === 'enabled' ? 'Notifications enabled.' : 'Enable notifications to get reminders.'}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {deferredPrompt && (
          <button className="primary-btn" onClick={handleInstallClick}>
            Install
          </button>
        )}
        {!deferredPrompt && notifStatus !== 'enabled' && (
          <button className="primary-btn" onClick={handleEnableNotifications}>
            Enable
          </button>
        )}
        <button className="secondary-btn" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </div>
  );
}
