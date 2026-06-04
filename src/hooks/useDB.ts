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
  /** Minutos de antecedência para enviar a notificação da próxima batida. */
  reminderLeadMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  dailyHours: 480,
  workDays: [1, 2, 3, 4, 5],
  defaultPunches: ['08:00', '12:00', '13:00', '17:00'],
  clockOffsetMinutes: 0,
  reminderLeadMinutes: 1,
};

/** Retorna o "agora" corrigido pelo offset do relógio configurado. */
export function adjustedNow(offsetMinutes: number): number {
  return Date.now() - offsetMinutes * 60_000;
}

// Calculations (pure functions, no DB dependency)
/**
 * Soma o tempo trabalhado considerando que as batidas se alternam por POSIÇÃO
 * (1ª = entrada, 2ª = saída, 3ª = entrada, ...) independentemente do campo `type`,
 * que pode estar incorreto após edições/inserções manuais. Isso evita perda de
 * intervalos quando o tipo gravado não bate com a ordem cronológica real.
 */
export function calculateWorkedMinutes(punches: Punch[]): number {
  let total = 0;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    total += (sorted[i + 1].timestamp - sorted[i].timestamp) / 60000;
  }
  return Math.round(total);
}

export function calculatePartialWorked(punches: Punch[]): number {
  let total = 0;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < sorted.length; i += 2) {
    const inP = sorted[i];
    const outP = sorted[i + 1];
    if (!inP) continue;
    const end = outP ? outP.timestamp : Date.now();
    total += (end - inP.timestamp) / 60000;
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

/** Converte "HH:MM" para Date no dia indicado (cria nova Date sem mutar a original). */
function timeToDate(hhmm: string, base: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Calcula a próxima batida esperada com base na duração de cada intervalo padrão.
 *
 * Regras:
 * - Se ainda não bateu nada, retorna o primeiro horário padrão.
 * - Para a próxima batida (índice n), pega a última batida real e adiciona a
 *   DURAÇÃO do intervalo padrão correspondente (defaults[n] - defaults[n-1]).
 * - Isso garante que tanto trabalho quanto pausa preservem suas durações
 *   originais (almoço de 1h10 não estica; jornada de 4h continua 4h).
 *
 * Retorna null se já bateu todas as batidas previstas.
 */
export function calculateNextExpectedPunch(
  punches: Punch[],
  defaultPunches: string[],
  today: Date = new Date(),
  dailyHours?: number,
): Date | null {
  if (!defaultPunches || defaultPunches.length === 0) return null;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length >= defaultPunches.length) return null;

  // Sem batidas reais → próxima é a primeira esperada
  if (sorted.length === 0) {
    return timeToDate(defaultPunches[0], today);
  }

  const nextIdx = sorted.length;
  const lastReal = sorted[sorted.length - 1].timestamp;

  // Última batida do dia: calcular pelo saldo (atinge dailyHours).
  if (dailyHours && nextIdx === defaultPunches.length - 1) {
    const lastP = sorted[sorted.length - 1];
    if (lastP.type === 'in') {
      // Está trabalhando: somar minutos restantes ao início do segmento atual.
      let completed = 0;
      for (let i = 0; i + 1 < sorted.length; i += 2) {
        completed += (sorted[i + 1].timestamp - sorted[i].timestamp) / 60000;
      }
      const remaining = dailyHours - completed;
      return new Date(lastP.timestamp + remaining * 60000);
    }
  }

  const prevDefault = timeToDate(defaultPunches[nextIdx - 1], today).getTime();
  const nextDefault = timeToDate(defaultPunches[nextIdx], today).getTime();
  const intervalMs = nextDefault - prevDefault;

  return new Date(lastReal + intervalMs);
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

  const punch = useCallback(async (offsetMinutes = 0) => {
    if (!user) return;
    const lastType = punches.length > 0 ? punches[punches.length - 1].type : 'out';
    const newType = lastType === 'in' ? 'out' : 'in';
    const now = adjustedNow(offsetMinutes);
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

const SETTINGS_CACHE_KEY = 'pc:settings:v1';

function readSettingsCache(): AppSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch { return null; }
}
function writeSettingsCache(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function useSettings() {
  const { user } = useAuth();
  // Seed from cache to evitar offset=0 antes do fetch (corrige bug em que
  // "Bater Saída" não considerava o atraso quando clicado muito rápido).
  const [settings, setSettingsState] = useState<AppSettings>(() => readSettingsCache() ?? DEFAULT_SETTINGS);
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
          const next: AppSettings = {
            dailyHours: data.daily_hours,
            workDays: data.work_days,
            defaultPunches: data.default_punches,
            clockOffsetMinutes: (data as { clock_offset_minutes?: number }).clock_offset_minutes ?? 0,
            reminderLeadMinutes: (data as { reminder_lead_minutes?: number }).reminder_lead_minutes ?? 1,
          };
          setSettingsState(next);
          writeSettingsCache(next);
          return;
        }
        setLoading(false);
      });
  }, [user]);

  const update = useCallback(async (s: AppSettings) => {
    if (!user) return;
    writeSettingsCache(s);
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      daily_hours: s.dailyHours,
      work_days: s.workDays,
      default_punches: s.defaultPunches,
      clock_offset_minutes: s.clockOffsetMinutes,
      reminder_lead_minutes: s.reminderLeadMinutes,
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
      .order('timestamp', { ascending: false })
      .limit(2000);
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
      .order('created_at', { ascending: false })
      .limit(2000);
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

  const add = useCallback(async (minutes: number, description: string, date?: string) => {
    if (!user) return;
    await supabase.from('adjustments').insert({
      user_id: user.id,
      date: date ?? todayStr(),
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

export async function updatePunch(id: string, timestamp: number, type?: 'in' | 'out'): Promise<void> {
  const patch: { timestamp: number; type?: 'in' | 'out' } = { timestamp };
  if (type) patch.type = type;
  await supabase.from('punches').update(patch).eq('id', id);
}

export async function addPunch(userId: string, punch: { timestamp: number; type: 'in' | 'out'; date: string }): Promise<void> {
  await supabase.from('punches').insert({ user_id: userId, ...punch });
}

/** Exclui TODAS as batidas e ajustes de um mês (YYYY-MM) do usuário. */
export async function deleteMonthData(userId: string, month: string): Promise<void> {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  await supabase.from('punches').delete().eq('user_id', userId).gte('date', start).lte('date', end);
  await supabase.from('adjustments').delete().eq('user_id', userId).gte('date', start).lte('date', end);
}

