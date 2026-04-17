import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut } from 'lucide-react';
import { useTodayPunches, calculatePartialWorked, formatMinutes } from '@/hooks/useDB';
import { useSettings } from '@/hooks/useDB';

export default function HomePage() {
  const { punches, punch } = useTodayPunches();
  const { settings } = useSettings();
  const [, setTick] = useState(0);
  const [justPunched, setJustPunched] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const isWorking = lastPunch?.type === 'in';
  const worked = calculatePartialWorked(punches);
  const expected = settings.dailyHours;
  const balance = worked - expected;

  // Calcula o offset (atraso/adiantamento) baseado na 1ª batida real vs 1ª esperada
  // e aplica nas próximas batidas esperadas para fechar a carga horária do dia.
  const nextExpectedPunch = (() => {
    const defaults = settings.defaultPunches || [];
    if (defaults.length === 0) return null;
    if (punches.length >= defaults.length) return null;

    const today = new Date();
    const toDate = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date(today);
      d.setHours(h, m, 0, 0);
      return d;
    };

    let offsetMs = 0;
    if (punches.length > 0) {
      const firstExpected = toDate(defaults[0]).getTime();
      offsetMs = punches[0].timestamp - firstExpected;
    }

    const nextIdx = punches.length;
    const nextExpected = toDate(defaults[nextIdx]).getTime() + offsetMs;
    const d = new Date(nextExpected);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  })();

  const handlePunch = useCallback(async () => {
    await punch(settings.clockOffsetMinutes ?? 0);
    setJustPunched(true);
    setTimeout(() => setJustPunched(false), 1200);
  }, [punch, settings.clockOffsetMinutes]);

  const nextType = !lastPunch || lastPunch.type === 'out' ? 'in' : 'out';

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

      {/* Punch button */}
      <div className="relative mt-10">
        {/* Pulse ring */}
        <AnimatePresence>
          {justPunched && (
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/30"
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
          className={`relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full shadow-lg transition-colors ${
            nextType === 'in'
              ? 'bg-primary text-primary-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {nextType === 'in' ? <LogIn className="mb-1 h-8 w-8" /> : <LogOut className="mb-1 h-8 w-8" />}
          <span className="text-sm font-semibold">{nextType === 'in' ? 'Entrada' : 'Saída'}</span>
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
