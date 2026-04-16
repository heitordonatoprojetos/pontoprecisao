import { useEffect, useMemo, useState } from 'react';
import type { AppSettings, Punch } from '@/hooks/useDB';

interface NextPunchInfo {
  at: Date;
  type: 'in' | 'out';
}

function parseTimeToDate(base: Date, time: string): Date | null {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isWorkDay(date: Date, workDays: number[]): boolean {
  return workDays.includes(date.getDay());
}

export function getNextPunchInfo(settings: AppSettings, punches: Punch[], now = new Date()): NextPunchInfo | null {
  const sortedDefaults = [...settings.defaultPunches].sort();
  if (sortedDefaults.length === 0) return null;

  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    if (!isWorkDay(day, settings.workDays)) continue;

    const startIndex = dayOffset === 0 ? Math.min(punches.length, sortedDefaults.length) : 0;

    for (let i = startIndex; i < sortedDefaults.length; i += 1) {
      const candidate = parseTimeToDate(day, sortedDefaults[i]);
      if (!candidate) continue;
      if (candidate <= now) continue;

      return {
        at: candidate,
        type: i % 2 === 0 ? 'in' : 'out',
      };
    }
  }

  return null;
}

let pendingTimer: number | null = null;

function clearReminderTimer() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function showNotification(type: 'in' | 'out') {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  const label = type === 'in' ? 'Entrada' : 'Saída';
  const body = `Agora é a hora da batida de ${label.toLowerCase()}.`;

  new Notification('Hora de bater o ponto', { body });
}

export function usePunchReminders(settings: AppSettings, punches: Punch[]) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [clock, setClock] = useState(() => Date.now());

  const nextPunch = useMemo(() => getNextPunchInfo(settings, punches, new Date(clock)), [clock, settings, punches]);

  useEffect(() => {
    if (permission === 'unsupported') return;
    if (permission === 'default') {
      Notification.requestPermission().then(setPermission).catch(() => setPermission(Notification.permission));
    }
  }, [permission]);

  useEffect(() => {
    clearReminderTimer();

    if (permission !== 'granted' || !nextPunch) return;

    const delay = nextPunch.at.getTime() - Date.now();
    if (delay <= 0) {
      setClock(Date.now());
      return;
    }

    pendingTimer = window.setTimeout(() => {
      showNotification(nextPunch.type);
      setClock(Date.now() + 1000);
    }, delay);

    return clearReminderTimer;
  }, [nextPunch, permission]);

  return {
    nextPunch,
    notificationPermission: permission,
  };
}
