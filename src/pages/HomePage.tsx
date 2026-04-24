import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Pencil, X } from 'lucide-react';
import {
  useTodayPunches,
  calculatePartialWorked,
  formatMinutes,
  calculateNextExpectedPunch,
  addPunch,
  todayStr,
} from '@/hooks/useDB';
import { useSettings } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const { punches, punch, refresh } = useTodayPunches();
  const { settings } = useSettings();
  const [, setTick] = useState(0);
  const [justPunched, setJustPunched] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const isWorking = lastPunch?.type === 'in';

  const worked = useMemo(() => calculatePartialWorked(punches), [punches]);
  const expected = settings.dailyHours;
  const balance = worked - expected;

  const nextExpectedPunch = useMemo(() => {
    const next = calculateNextExpectedPunch(punches, settings.defaultPunches || []);
    return next ? next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  }, [punches, settings.defaultPunches]);

  const handlePunch = useCallback(async () => {
    await punch(settings.clockOffsetMinutes ?? 0);
    setJustPunched(true);
    setTimeout(() => setJustPunched(false), 1200);
  }, [punch, settings.clockOffsetMinutes]);

  const nextType = !lastPunch || lastPunch.type === 'out' ? 'in' : 'out';

  const openManual = () => {
    const now = new Date();
    setManualTime(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    );
    setShowManual(true);
  };

  const submitManual = async () => {
    if (!manualTime || !user) return;
    setManualSaving(true);
    const [h, m] = manualTime.split(':').map(Number);
    const date = todayStr();
    const d = new Date(date + 'T12:00:00');
    d.setHours(h, m, 0, 0);
    await addPunch(user.id, {
      timestamp: d.getTime(),
      type: nextType,
      date,
    });
    await refresh();
    if (navigator.vibrate) navigator.vibrate(50);
    setShowManual(false);
    setManualSaving(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-12">
      {/* Clock */}
      <div className="mb-2 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="mt-1 text-5xl font-bold tracking-tight text-foreground tabular-nums">
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Status badge + próxima batida */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
          isWorking ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isWorking ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          {isWorking ? 'Trabalhando' : 'Fora'}
        </div>
        {nextExpectedPunch && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
            <span className="text-xs">Próxima:</span>
            <span className="tabular-nums text-foreground font-semibold">{nextExpectedPunch}</span>
          </div>
        )}
      </div>

      {/* Punch buttons */}
      <div className="relative mt-10 flex items-center gap-4">
        {/* Pulse ring */}
        <AnimatePresence>
          {justPunched && (
            <motion.div
              className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handlePunch}
          aria-label="Bater ponto agora"
          className={`relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full shadow-lg transition-colors ${
            nextType === 'in'
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {nextType === 'in' ? <LogIn className="mb-1 h-8 w-8" /> : <LogOut className="mb-1 h-8 w-8" />}
          <span className="text-sm font-semibold">{nextType === 'in' ? 'Entrada' : 'Saída'}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={openManual}
          aria-label="Bater com horário customizado"
          className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-secondary"
        >
          <Pencil className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Stats */}
      <div className="mt-10 grid w-full max-w-sm grid-cols-3 gap-3">
        <StatCard label="Trabalhado" value={formatMinutes(worked)} />
        <StatCard label="Esperado" value={formatMinutes(expected)} />
        <StatCard label="Saldo" value={formatMinutes(balance)} variant={balance >= 0 ? 'positive' : 'negative'} />
      </div>

      {/* Last punch */}
      {lastPunch && (
        <p className="mt-6 text-sm text-muted-foreground">
          Última batida: {new Date(lastPunch.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {' '}({lastPunch.type === 'in' ? 'Entrada' : 'Saída'})
        </p>
      )}

      {/* Today's punches */}
      {punches.length > 0 && (
        <div className="mt-6 w-full max-w-sm">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Batidas de hoje</p>
          <div className="flex flex-wrap gap-2">
            {punches.map((p) => (
              <span key={p.id} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                p.type === 'in' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {p.type === 'in' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual punch modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !manualSaving && setShowManual(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-card border border-border p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-base">Bater com horário</p>
              <button onClick={() => setShowManual(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Tipo: <span className="font-semibold text-foreground">{nextType === 'in' ? 'Entrada' : 'Saída'}</span>
            </p>
            <input
              type="time"
              value={manualTime}
              onChange={e => setManualTime(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base tabular-nums text-center"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowManual(false)}
                disabled={manualSaving}
                className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitManual}
                disabled={manualSaving || !manualTime}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {manualSaving ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, variant }: { label: string; value: string; variant?: 'positive' | 'negative' }) {
  return (
    <div className="rounded-xl bg-card p-3 text-center shadow-sm border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${
        variant === 'positive' ? 'text-success' : variant === 'negative' ? 'text-destructive' : 'text-foreground'
      }`}>{value}</p>
    </div>
  );
}
