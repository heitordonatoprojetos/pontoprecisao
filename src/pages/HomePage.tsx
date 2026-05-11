import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Pencil, X, Plus, Zap } from 'lucide-react';
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
  const [now, setNow] = useState(() => new Date());
  const [justPunched, setJustPunched] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Tick segundo-a-segundo (alinhado ao próximo segundo cheio).
  // Não exibimos os segundos — mas isso garante que minuto vire imediatamente.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 1000 - (d.getTime() % 1000));
    };
    tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const isWorking = lastPunch?.type === 'in';

  const worked = useMemo(() => calculatePartialWorked(punches), [punches]);
  const expected = settings.dailyHours;
  const balance = worked - expected;

  const nextExpectedPunch = useMemo(() => {
    const next = calculateNextExpectedPunch(punches, settings.defaultPunches || [], new Date(), settings.dailyHours);
    return next ? next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  }, [punches, settings.defaultPunches, settings.dailyHours]);

  // Delta da última batida medido pelo IMPACTO no saldo:
  // - IN  (entrada/retorno): chegar antes = + (verde); atrasado = − (vermelho).
  // - OUT (saída): sair depois = + (verde); sair antes = − (vermelho).
  // Em ambos os casos, sinal positivo => batida contribui para aumentar o saldo.
  const lastPunchDelta = useMemo(() => {
    if (!lastPunch) return null;
    const defaults = settings.defaultPunches || [];
    const idx = punches.length - 1;
    if (idx < 0 || idx >= defaults.length) return null;
    const base = new Date(lastPunch.timestamp);
    let expectedMs: number;
    if (idx === 0) {
      const [hh, mm] = defaults[0].split(':').map(Number);
      const e = new Date(base);
      e.setHours(hh, mm, 0, 0);
      expectedMs = e.getTime();
    } else {
      const prevReal = punches[idx - 1].timestamp;
      const [ph, pm] = defaults[idx - 1].split(':').map(Number);
      const [nh, nm] = defaults[idx].split(':').map(Number);
      const prevDef = new Date(base); prevDef.setHours(ph, pm, 0, 0);
      const nextDef = new Date(base); nextDef.setHours(nh, nm, 0, 0);
      expectedMs = prevReal + (nextDef.getTime() - prevDef.getTime());
    }
    const diffMin = Math.round((lastPunch.timestamp - expectedMs) / 60000);
    // sinal pelo impacto no saldo: out → diff positivo é bom; in → diff positivo é ruim.
    return lastPunch.type === 'out' ? diffMin : -diffMin;
  }, [lastPunch, punches, settings.defaultPunches]);

  const formatDelta = (d: number) => (d === 0 ? '±0' : d > 0 ? `+${d}` : `${d}`);
  const lastPunchLabel = lastPunch
    ? new Date(lastPunch.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handlePunch = useCallback(async () => {
    await punch(settings.clockOffsetMinutes ?? 0);
    setJustPunched(true);
    setTimeout(() => setJustPunched(false), 1200);
  }, [punch, settings.clockOffsetMinutes]);

  const nextType = !lastPunch || lastPunch.type === 'out' ? 'in' : 'out';

  const openManual = () => {
    const d = new Date();
    setManualTime(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
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

  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pb-24 pt-12 lg:px-8 lg:pb-12 lg:pt-10">
      {/* === DESKTOP LAYOUT === */}
      <div className="hidden w-full max-w-7xl lg:block">
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-8">
            {/* Hero card */}
            <div className="relative flex flex-col items-center rounded-3xl border border-border bg-card p-10 shadow-sm">
              <p className="text-base font-medium capitalize text-muted-foreground">{dateLabel}</p>
              <p className="mt-2 text-7xl font-bold tracking-tight tabular-nums text-foreground">{timeLabel}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
                  isWorking ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${isWorking ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                  {isWorking ? 'Trabalhando' : 'Fora'}
                </div>
                {nextExpectedPunch && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
                    <span>Próxima:</span>
                    <span className="font-semibold tabular-nums text-foreground">{nextExpectedPunch}</span>
                  </div>
                )}
              </div>
              {lastPunchLabel && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm">
                  <span className="text-muted-foreground">Última batida:</span>
                  <span className="font-semibold tabular-nums text-foreground">{lastPunchLabel}</span>
                  {lastPunchDelta !== null && (
                    <span className={`font-bold tabular-nums ${
                      lastPunchDelta === 0 ? 'text-muted-foreground' : lastPunchDelta > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {formatDelta(lastPunchDelta)}
                    </span>
                  )}
                </div>
              )}

              <div className="relative mt-8 flex items-center gap-5">
                <AnimatePresence>
                  {justPunched && (
                    <motion.div
                      className="absolute left-[88px] top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                    />
                  )}
                </AnimatePresence>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={handlePunch}
                  aria-label={`Bater ${nextType === 'in' ? 'entrada' : 'saída'} agora`}
                  className={`relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full font-bold shadow-xl transition-all ${
                    nextType === 'in'
                      ? 'bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/40'
                      : 'bg-destructive text-destructive-foreground shadow-destructive/30 hover:shadow-destructive/40'
                  }`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                >
                  {nextType === 'in' ? <LogIn className="mb-2 h-10 w-10 drop-shadow" /> : <LogOut className="mb-2 h-10 w-10 drop-shadow" />}
                  <span className="text-lg font-bold tracking-wide">{nextType === 'in' ? 'Entrada' : 'Saída'}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={openManual}
                  aria-label="Bater com horário customizado"
                  className="relative z-10 flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-secondary"
                >
                  <Pencil className="h-5 w-5" />
                  <span className="text-[10px] font-medium text-muted-foreground">Manual</span>
                </motion.button>
              </div>

              {lastPunch && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Última batida: <span className="font-medium text-foreground tabular-nums">
                    {new Date(lastPunch.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span> ({lastPunch.type === 'in' ? 'Entrada' : 'Saída'})
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-5">
              <StatCard label="Trabalhado" value={formatMinutes(worked)} />
              <StatCard label="Esperado" value={formatMinutes(expected)} />
              <StatCard label="Saldo" value={formatMinutes(balance)} variant={balance >= 0 ? 'positive' : 'negative'} />
            </div>
          </div>

          {/* Sidebar — histórico de hoje */}
          <aside className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="mb-4 text-base font-bold text-foreground">Batidas de hoje</p>
            {punches.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma batida ainda</p>
            ) : (
              <ul className="space-y-2">
                {punches.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        p.type === 'in' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold tabular-nums">
                          {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{p.type === 'in' ? 'Entrada' : 'Saída'}</p>
                      </div>
                    </div>
                    {p.type === 'in' ? <LogIn className="h-4 w-4 text-primary" /> : <LogOut className="h-4 w-4 text-destructive" />}
                  </li>
                ))}
              </ul>
            )}
            {nextExpectedPunch && (
              <div className="mt-5 rounded-xl bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Próxima esperada</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-primary">{nextExpectedPunch}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* === MOBILE LAYOUT (intacto) === */}
      <div className="flex w-full flex-col items-center lg:hidden">
        <div className="mb-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight text-foreground tabular-nums">{timeLabel}</p>
        </div>

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

        {lastPunchLabel && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs">
            <span className="text-muted-foreground">Última batida:</span>
            <span className="font-semibold tabular-nums text-foreground">{lastPunchLabel}</span>
            {lastPunchDelta !== null && (
              <span className={`font-bold tabular-nums ${
                lastPunchDelta === 0 ? 'text-muted-foreground' : lastPunchDelta > 0 ? 'text-success' : 'text-destructive'
              }`}>
                {formatDelta(lastPunchDelta)}
              </span>
            )}
          </div>
        )}

        {/* Botões de batida agora são flutuantes (FAB) — ver fim do layout mobile */}
        <div className="mt-8" />

        <div className="mt-10 grid w-full max-w-sm grid-cols-3 gap-3">
          <StatCard label="Trabalhado" value={formatMinutes(worked)} />
          <StatCard label="Esperado" value={formatMinutes(expected)} />
          <StatCard label="Saldo" value={formatMinutes(balance)} variant={balance >= 0 ? 'positive' : 'negative'} />
        </div>


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

      {/* === FAB MOBILE — botão flutuante de batida (acima da BottomNav) === */}
      <div className="lg:hidden">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setFabOpen(false)}
            />
          )}
        </AnimatePresence>

        <div className="fixed bottom-20 right-5 z-50 flex flex-col items-end gap-3 safe-bottom">
          <AnimatePresence>
            {fabOpen && (
              <>
                <motion.button
                  key="manual"
                  initial={{ opacity: 0, y: 16, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.8 }}
                  transition={{ duration: 0.18, delay: 0.05 }}
                  onClick={() => { setFabOpen(false); openManual(); }}
                  className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3.5 shadow-lg"
                  aria-label="Bater com horário customizado"
                >
                  <span className="text-sm font-medium text-foreground">Editar horário</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <Pencil className="h-6 w-6" />
                  </span>
                </motion.button>

                <motion.button
                  key="direct"
                  initial={{ opacity: 0, y: 16, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.8 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => { setFabOpen(false); handlePunch(); }}
                  className={`flex items-center gap-3 rounded-full px-5 py-3.5 shadow-lg ${
                    nextType === 'in' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
                  }`}
                  aria-label={`Bater ${nextType === 'in' ? 'entrada' : 'saída'} agora`}
                >
                  <span className="text-sm font-semibold">
                    {nextType === 'in' ? 'Bater entrada' : 'Bater saída'}
                  </span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <Zap className="h-6 w-6" />
                  </span>
                </motion.button>
              </>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFabOpen(o => !o)}
            aria-label={fabOpen ? 'Fechar opções' : 'Abrir opções de batida'}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-xl transition-colors ${
              fabOpen
                ? 'bg-secondary text-secondary-foreground'
                : nextType === 'in'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-destructive text-destructive-foreground'
            }`}
          >
            <AnimatePresence>
              {justPunched && (
                <motion.span
                  className="absolute inset-0 rounded-full bg-primary/40"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                />
              )}
            </AnimatePresence>
            <motion.span
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Plus className="h-8 w-8" />
            </motion.span>
          </motion.button>
        </div>
      </div>

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
    <div className="rounded-xl bg-card p-3 text-center shadow-sm border border-border lg:p-5">
      <p className="text-xs text-muted-foreground lg:text-sm">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums lg:text-3xl lg:mt-2 ${
        variant === 'positive' ? 'text-success' : variant === 'negative' ? 'text-destructive' : 'text-foreground'
      }`}>{value}</p>
    </div>
  );
}
