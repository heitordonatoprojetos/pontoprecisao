/**
 * Agendador leve de lembrete de batida.
 *
 * Usa um único setTimeout que dispara 1 minuto antes da próxima batida esperada.
 * Reutiliza calculateNextExpectedPunch (regra de "deslize") para casar com a
 * exibição da HomePage. Toca um beep curto (data URI) + vibração + notificação
 * (preferindo Service Worker para funcionar com o app em background no PWA).
 */
import { calculateNextExpectedPunch, type Punch } from '@/hooks/useDB';

const STORAGE_KEY = 'pc:notifications';
const DEFAULT_LEAD_MS = 60_000; // 1 min antes (padrão)

let activeTimer: number | null = null;

export function isNotificationsEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function setNotificationsEnabled(value: boolean) {
  try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* noop */ }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Beep curto (~120ms) gerado via WebAudio. Sem arquivo externo.
function playBeep() {
  try {
    const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.18;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 280);
    // segundo beep
    setTimeout(() => {
      try {
        const ctx2 = new AudioCtx();
        const o2 = ctx2.createOscillator();
        const g2 = ctx2.createGain();
        o2.type = 'sine';
        o2.frequency.value = 1100;
        g2.gain.value = 0.18;
        o2.connect(g2).connect(ctx2.destination);
        o2.start();
        setTimeout(() => { o2.stop(); ctx2.close(); }, 280);
      } catch { /* noop */ }
    }, 350);
  } catch { /* noop */ }
}

export async function fireReminder(targetTime: string) {
  if (!isNotificationsEnabled()) return;
  const title = 'Ponto Certo';
  const body = `Lembrete: próxima batida às ${targetTime} (em ~1 min)`;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'punch-reminder',
            requireInteraction: false,
          });
        } else {
          new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
      } else {
        new Notification(title, { body, icon: '/icons/icon-192.png' });
      }
    } catch { /* noop */ }
  }

  playBeep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

export function clearReminder() {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}

/**
 * Agenda 1 lembrete (substitui qualquer agendamento anterior).
 * Retorna o timestamp alvo (ms) ou null se nada foi agendado.
 */
export function scheduleReminder(
  punches: Punch[],
  defaultPunches: string[],
  clockOffsetMinutes = 0,
  leadMinutes = 1,
): number | null {
  clearReminder();
  if (!isNotificationsEnabled()) return null;
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  const next = calculateNextExpectedPunch(punches, defaultPunches);
  if (!next) return null;

  const leadMs = Math.max(0, leadMinutes) * 60_000 || DEFAULT_LEAD_MS;
  const target = next.getTime() - leadMs - clockOffsetMinutes * 60_000;
  const delay = target - Date.now();
  if (delay <= 0) return null;
  const timeStr = next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  activeTimer = window.setTimeout(() => {
    activeTimer = null;
    fireReminder(timeStr);
  }, delay);
  return target;
}

export async function testNotification() {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return false;
  await fireReminder(new Date(Date.now() + 60_000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  return true;
}
