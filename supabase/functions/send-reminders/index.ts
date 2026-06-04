// Cron-invoked function (every minute) that sends push reminders for the
// next expected punch. Mirrors the client calculateNextExpectedPunch logic.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DEFAULT_LEAD_MIN = 1;
const WINDOW_MIN = 2;

interface Punch { timestamp: number; type: 'in' | 'out'; date: string }
interface Sub {
  id: string; user_id: string; endpoint: string; p256dh: string; auth: string;
  tz: string; last_notified_date: string | null; last_notified_punch_idx: number;
}

function todayStrInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function timeInTzToMs(dateStr: string, hhmm: string, tz: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const guess = Date.UTC(+dateStr.slice(0,4), +dateStr.slice(5,7) - 1, +dateStr.slice(8,10), h, m, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const o: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') o[p.type] = p.value;
  const asUtc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
  const offsetMs = asUtc - guess;
  return guess - offsetMs;
}

function nextExpectedPunchMs(punches: Punch[], defaults: string[], date: string, tz: string, dailyHoursMin?: number): { ms: number; idx: number } | null {
  if (!defaults?.length) return null;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length >= defaults.length) return null;
  const idx = sorted.length;
  if (sorted.length === 0) return { ms: timeInTzToMs(date, defaults[0], tz), idx: 0 };
  const last = sorted[sorted.length - 1].timestamp;
  if (dailyHoursMin && idx === defaults.length - 1 && sorted[sorted.length - 1].type === 'in') {
    let completed = 0;
    for (let i = 0; i + 1 < sorted.length; i += 2) completed += (sorted[i + 1].timestamp - sorted[i].timestamp) / 60000;
    return { ms: last + (dailyHoursMin - completed) * 60000, idx };
  }
  const prev = timeInTzToMs(date, defaults[idx - 1], tz);
  const cur = timeInTzToMs(date, defaults[idx], tz);
  return { ms: last + (cur - prev), idx };
}

async function processUser(userId: string, subs: Sub[]) {
  const { data: settings } = await admin.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (!settings) return;
  const defaults: string[] = settings.default_punches || [];
  const workDays: number[] = settings.work_days || [];
  const dailyHours: number = settings.daily_hours || 0;
  const clockOffset: number = (settings as { clock_offset_minutes?: number }).clock_offset_minutes ?? 0;

  for (const sub of subs) {
    const today = todayStrInTz(sub.tz);
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    if (!workDays.includes(dow)) continue;

    const { data: punchesRows } = await admin.from('punches').select('*').eq('user_id', userId).eq('date', today).order('timestamp', { ascending: true });
    const punches: Punch[] = (punchesRows || []).map((r) => ({ timestamp: Number(r.timestamp), type: r.type as 'in'|'out', date: r.date }));

    const next = nextExpectedPunchMs(punches, defaults, today, sub.tz, dailyHours);
    if (!next) continue;
    const target = next.ms - LEAD_MIN * 60_000 - clockOffset * 60_000;
    const diffMin = (target - Date.now()) / 60_000;
    if (diffMin > 0 || diffMin < -WINDOW_MIN) continue;
    if (sub.last_notified_date === today && sub.last_notified_punch_idx === next.idx) continue;

    const punchTime = new Date(next.ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: sub.tz });
    const payload = JSON.stringify({
      title: 'Ponto Certo',
      body: `Lembrete: próxima batida às ${punchTime} (em ~1 min)`,
      tag: `punch-${today}-${next.idx}`,
      url: '/',
    });
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      await admin.from('push_subscriptions').update({ last_notified_date: today, last_notified_punch_idx: next.idx }).eq('id', sub.id);
    } catch (e) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('push send failed', err);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { data: allSubs, error } = await admin.from('push_subscriptions').select('*');
    if (error) throw error;
    const byUser = new Map<string, Sub[]>();
    for (const s of (allSubs || []) as Sub[]) {
      const arr = byUser.get(s.user_id) || [];
      arr.push(s); byUser.set(s.user_id, arr);
    }
    for (const [uid, subs] of byUser) await processUser(uid, subs);
    return new Response(JSON.stringify({ ok: true, users: byUser.size }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
