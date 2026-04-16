import { useState, useEffect, useCallback } from 'react';
import {
  Punch, AppSettings, Adjustment,
  getPunchesByDate, getSettings, addPunch, deletePunch, updatePunch,
  getAllPunches, getAllAdjustments, addAdjustment, deleteAdjustment,
  saveSettings, DEFAULT_SETTINGS, calculateWorkedMinutes, calculatePartialWorked,
  todayStr, generateId, formatMinutes,
} from '@/lib/db';

export function useTodayPunches() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await getPunchesByDate(todayStr());
    setPunches(p);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const punch = useCallback(async () => {
    const now = Date.now();
    const lastType = punches.length > 0 ? punches[punches.length - 1].type : 'out';
    const newType = lastType === 'in' ? 'out' : 'in';
    const p: Punch = {
      id: generateId(),
      timestamp: now,
      type: newType,
      date: todayStr(),
    };
    await addPunch(p);
    await refresh();
    // vibrate
    if (navigator.vibrate) navigator.vibrate(50);
    return p;
  }, [punches, refresh]);

  return { punches, loading, punch, refresh };
}

export function usePunchesByDate(date: string) {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await getPunchesByDate(date);
    setPunches(p);
    setLoading(false);
  }, [date]);

  useEffect(() => { refresh(); }, [refresh]);

  return { punches, loading, refresh };
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => { setSettingsState(s); setLoading(false); });
  }, []);

  const update = useCallback(async (s: AppSettings) => {
    await saveSettings(s);
    setSettingsState(s);
  }, []);

  return { settings, loading, update };
}

export function useAllPunches() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await getAllPunches();
    setPunches(p.sort((a, b) => b.timestamp - a.timestamp));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { punches, loading, refresh };
}

export function useAdjustments() {
  const [adjustments, setAdj] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const a = await getAllAdjustments();
    setAdj(a);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (minutes: number, description: string) => {
    await addAdjustment({
      id: generateId(),
      date: todayStr(),
      minutes,
      description,
      createdAt: Date.now(),
    });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteAdjustment(id);
    await refresh();
  }, [refresh]);

  return { adjustments, loading, add, remove, refresh };
}

export { calculateWorkedMinutes, calculatePartialWorked, formatMinutes, todayStr, generateId, deletePunch, updatePunch, addPunch, getPunchesByDate };
