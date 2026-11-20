import { AppNotification } from '../types';

export type BrowserNotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

const PUSHED_NOTIF_STORAGE_KEY = 'tx_pushed_notif_ids_v1';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getNotificationPermissionState(): BrowserNotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function ensureWebPushSubscribed(userId: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !userId ||
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return false;
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js?v=20261119b', {
        updateViaCache: 'none',
      });
    }
    const readyReg = await navigator.serviceWorker.ready;
    const activeReg = readyReg || reg;

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) return false;
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) return false;

    let sub = await activeReg.pushManager.getSubscription();
    if (!sub) {
      const keyBytes = urlBase64ToUint8Array(publicKey);
      sub = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });
    }

    const subJson = sub.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subJson }),
    });

    return true;
  } catch (err) {
    console.warn('Web Push subscription skipped:', err);
    return false;
  }
}

export async function requestBrowserNotificationPermission(
  userId?: string
): Promise<BrowserNotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    if (userId) {
      await ensureWebPushSubscribed(userId);
    }
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  try {
    const res = await Notification.requestPermission();
    if (res === 'granted' && userId) {
      await ensureWebPushSubscribed(userId);
    }
    return res;
  } catch {
    return Notification.permission;
  }
}

export async function sendServerRoomPushNotification(params: {
  userIds: string[];
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<void> {
  if (!params.userIds || params.userIds.length === 0) return;
  try {
    await fetch('/api/push/send-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn('Background push trigger skipped:', err);
  }
}

function getPushedNotificationIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PUSHED_NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markNotificationLocallyPushed(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const existing = getPushedNotificationIds();
    if (existing.includes(id)) return;
    const updated = [...existing, id].slice(-100);
    window.localStorage.setItem(PUSHED_NOTIF_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export async function triggerSystemPushNotification(
  notif: AppNotification,
  onClickNavigate?: (url: string) => void
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const pushedIds = getPushedNotificationIds();
  if (pushedIds.includes(notif.id)) return;

  // Avoid popping very old historical notifications (> 15 minutes old)
  const createdMs = notif.createdAt ? new Date(notif.createdAt).getTime() : Date.now();
  if (!isNaN(createdMs) && Date.now() - createdMs > 15 * 60 * 1000) {
    markNotificationLocallyPushed(notif.id);
    return;
  }

  markNotificationLocallyPushed(notif.id);

  const title = notif.title || notif.titleBn || 'Room Code Chole Asche';
  const body =
    notif.message ||
    notif.messageBn ||
    'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.';
  const url = notif.link || '/app';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (reg.active) {
          reg.active.postMessage({
            type: 'TX_SHOW_NOTIFICATION',
            payload: { title, body, url, tag: notif.id },
          });
          return;
        }
        await reg.showNotification(title, {
          body,
          icon: '/pwa-icon-192x192.png?v=20261119b',
          badge: '/app-icon-192.png',
          tag: notif.id,
          requireInteraction: true,
          data: { url },
        });
        return;
      }
    }

    const browserNotif = new Notification(title, {
      body,
      icon: '/pwa-icon-192x192.png?v=20261119b',
      tag: notif.id,
    });
    browserNotif.onclick = () => {
      try {
        window.focus();
      } catch {}
      if (onClickNavigate) {
        onClickNavigate(url);
      }
      browserNotif.close();
    };
  } catch (err) {
    console.warn('Could not display system notification:', err);
  }
}
