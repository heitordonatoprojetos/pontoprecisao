import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Punch {
  id: string;
  timestamp: number;
  type: 'in' | 'out';
  date: string;
}

export interface Adjustment {
  id: string;
  date: string;
  minutes: number;
  description: string;
  createdAt: number;
}

export interface AppSettings {
  dailyHours: number;
  workDays: number[];
  defaultPunches: string[];
  /** Ajuste do relógio em minutos. Positivo = relógio adiantado (subtrai). Negativo = atrasado (soma). */
  clockOffsetMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  dailyHours: 480,
  workDays: [1, 2, 3, 4, 5],
  defaultPunches: ['08:00', '12:00', '13:00', '17:00'],
  clockOffsetMinutes: 0,
};

/** Retorna o "agora" corrigido pelo offset do relógio configurado. */
export function adjustedNow(offsetMinutes: number): number {
  return Date.now() - offsetMinutes * 60_000;
}

// Calculations (pure functions, no DB dependency)
export function calculateWorkedMinutes(punches: Punch[]): number {
  let total = 0;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < sorted.length - 1; i += 2) {
    if (sorted[i].type === 'in' && sorted[i + 1]?.type === 'out') {
      total += (sorted[i + 1].timestamp - sorted[i].timestamp) / 60000;
    }
  }
  return Math.round(total);
}

export function calculatePartialWorked(punches: Punch[]): number {
  let total = 0;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < sorted.length; i += 2) {
    const inP = sorted[i];
    const outP = sorted[i + 1];
    if (inP?.type === 'in') {
      const end = outP?.type === 'out' ? outP.timestamp : Date.now();
      total += (end - inP.timestamp) / 60000;
    }
  }
  return Math.round(total);
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Hooks

export function useTodayPunches() {
  const { user } = useAuth();
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('punches')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayStr())
      .order('timestamp', { ascending: true });
    setPunches((data || []).map(r => ({ id: r.id, timestamp: Number(r.timestamp), type: r.type as 'in' | 'out', date: r.date })));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const punch = useCallback(async () => {
    if (!user) return;
    const lastType = punches.length > 0 ? punches[punches.length - 1].type : 'out';
    const newType = lastType === 'in' ? 'out' : 'in';
    const now = Date.now();
    await supabase.from('punches').insert({
      user_id: user.id,
      timestamp: now,
      type: newType,
      date: todayStr(),
    });
    await refresh();
    if (navigator.vibrate) navigator.vibrate(50);
  }, [punches, refresh, user]);

  return { punches, loading, punch, refresh };
}

export function usePunchesByDate(date: string) {
  const { user } = useAuth();
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('punches')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('timestamp', { ascending: true });
    setPunches((data || []).map(r => ({ id: r.id, timestamp: Number(r.timestamp), type: r.type as 'in' | 'out', date: r.date })));
    setLoading(false);
  }, [date, user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { punches, loading, refresh };
}

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettingsState({
            dailyHours: data.daily_hours,
            workDays: data.work_days,
            defaultPunches: data.default_punches,
            clockOffsetMinutes: (data as { clock_offset_minutes?: number }).clock_offset_minutes ?? 0,
          });
        }
        setLoading(false);
      });
  }, [user]);

  const update = useCallback(async (s: AppSettings) => {
    if (!user) return;
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      daily_hours: s.dailyHours,
      work_days: s.workDays,
      default_punches: s.defaultPunches,
      clock_offset_minutes: s.clockOffsetMinutes,
    } as never, { onConflict: 'user_id' });
    setSettingsState(s);
  }, [user]);

  return { settings, loading, update };
}

export function useAllPunches() {
  const { user } = useAuth();
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('punches')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });
    setPunches((data || []).map(r => ({ id: r.id, timestamp: Number(r.timestamp), type: r.type as 'in' | 'out', date: r.date })));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { punches, loading, refresh };
}

export function useAdjustments() {
  const { user } = useAuth();
  const [adjustments, setAdj] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('adjustments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAdj((data || []).map(r => ({
      id: r.id,
      date: r.date,
      minutes: r.minutes,
      description: r.description,
      createdAt: new Date(r.created_at).getTime(),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (minutes: number, description: string) => {
    if (!user) return;
    await supabase.from('adjustments').insert({
      user_id: user.id,
      date: todayStr(),
      minutes,
      description,
    });
    await refresh();
  }, [refresh, user]);

  const remove = useCallback(async (id: string) => {
    await supabase.from('adjustments').delete().eq('id', id);
    await refresh();
  }, [refresh]);

  return { adjustments, loading, add, remove, refresh };
}

// Direct DB operations for DailyPage
export async function getPunchesByDate(userId: string, date: string): Promise<Punch[]> {
  const { data } = await supabase
    .from('punches')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('timestamp', { ascending: true });
  return (data || []).map(r => ({ id: r.id, timestamp: Number(r.timestamp), type: r.type as 'in' | 'out', date: r.date }));
}

export async function deletePunch(id: string): Promise<void> {
  await supabase.from('punches').delete().eq('id', id);
}

export async function updatePunch(id: string, timestamp: number): Promise<void> {
  await supabase.from('punches').update({ timestamp }).eq('id', id);
}

export async function addPunch(userId: string, punch: { timestamp: number; type: 'in' | 'out'; date: string }): Promise<void> {
  await supabase.from('punches').insert({ user_id: userId, ...punch });
}
