// Web Push subscription management. Public VAPID key is safe in client code.
import { supabase } from '@/integrations/supabase/client';

export const VAPID_PUBLIC_KEY =
  'BIhAJbDzPDOoFnUSepCK0mQN_ht22UX6PmEBJ3OpTaVNuNyeg__R2Xv3DG3Hzcr0mgVes5nRzMEIONu4Bq9jPiA';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export async function subscribeWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    const { error } = await supabase.functions.invoke('push-subscribe', {
      body: { action: 'subscribe', subscription: sub.toJSON(), tz },
    });
    return !error;
  } catch (e) {
    console.error('subscribeWebPush failed', e);
    return false;
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await supabase.functions.invoke('push-subscribe', { body: { action: 'unsubscribe', endpoint: sub.endpoint } });
  } catch { /* noop */ }
  try { await sub.unsubscribe(); } catch { /* noop */ }
}
