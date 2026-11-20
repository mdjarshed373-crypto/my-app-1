/**
 * TX TOUR BD - Standalone Display & Breakout Utilities
 * Pure PWA Standalone configuration without triggering Chrome's browser fullscreen warnings.
 */

export function isEmbeddedInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Break out of AI Studio or any hosting wrapper iframe into standalone full screen.
 * Does NOT call browser requestFullscreen so no Chrome exit toasts appear.
 */
export function breakoutToStandalone(): void {
  const standaloneUrl = getDirectStandaloneUrl();

  try {
    const link = document.createElement('a');
    link.href = standaloneUrl;
    link.target = '_top';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
    }, 100);
    return;
  } catch {
    // continue
  }

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = standaloneUrl;
      return;
    }
  } catch {}
  window.open(standaloneUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Return the clean direct standalone app URL (without AI Studio chrome/chat).
 */
export function getDirectStandaloneUrl(): string {
  try {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path === '/' ? '' : path}`;
  } catch {
    return window.location.href;
  }
}
