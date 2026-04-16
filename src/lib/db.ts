import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Punch {
  id: string;
  timestamp: number;
  type: 'in' | 'out';
  date: string; // YYYY-MM-DD
}

export interface DayRecord {
  date: string;
  punches: Punch[];
}

export interface Adjustment {
  id: string;
  date: string;
  minutes: number; // positive = credit, negative = debit
  description: string;
  createdAt: number;
}

export interface AppSettings {
  dailyHours: number; // in minutes
  workDays: number[]; // 0=Sun, 1=Mon...6=Sat
  defaultPunches: string[]; // ["08:00","12:00","13:00","17:00"]
}

interface PontoDB extends DBSchema {
  punches: {
    key: string;
    value: Punch;
    indexes: { 'by-date': string };
  };
  adjustments: {
    key: string;
    value: Adjustment;
    indexes: { 'by-date': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'ponto-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PontoDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PontoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const punchStore = db.createObjectStore('punches', { keyPath: 'id' });
        punchStore.createIndex('by-date', 'date');

        const adjStore = db.createObjectStore('adjustments', { keyPath: 'id' });
        adjStore.createIndex('by-date', 'date');

        db.createObjectStore('settings', { keyPath: 'id' as any });
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_SETTINGS: AppSettings = {
  dailyHours: 480, // 8h
  workDays: [1, 2, 3, 4, 5],
  defaultPunches: ['08:00', '12:00', '13:00', '17:00'],
};

// Settings
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const s = await db.get('settings', 'main');
  return s || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { ...settings, id: 'main' } as any);
}

// Punches
export async function addPunch(punch: Punch): Promise<void> {
  const db = await getDB();
  await db.put('punches', punch);
}

export async function getPunchesByDate(date: string): Promise<Punch[]> {
  const db = await getDB();
  const punches = await db.getAllFromIndex('punches', 'by-date', date);
  return punches.sort((a, b) => a.timestamp - b.timestamp);
}

export async function deletePunch(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('punches', id);
}

export async function updatePunch(punch: Punch): Promise<void> {
  const db = await getDB();
  await db.put('punches', punch);
}

export async function getAllPunches(): Promise<Punch[]> {
  const db = await getDB();
  return db.getAll('punches');
}

// Adjustments
export async function addAdjustment(adj: Adjustment): Promise<void> {
  const db = await getDB();
  await db.put('adjustments', adj);
}

export async function getAllAdjustments(): Promise<Adjustment[]> {
  const db = await getDB();
  const adjs = await db.getAll('adjustments');
  return adjs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteAdjustment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('adjustments', id);
}

// Calculations
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

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
