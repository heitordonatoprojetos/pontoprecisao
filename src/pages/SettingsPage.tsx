import { useState } from 'react';
import { Save, Plus, Trash2, Clock, LogOut, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';
import type { AppSettings } from '@/hooks/useDB';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MIN_PUNCHES = 6;

export default function SettingsPage() {
  const { settings, update, loading } = useSettings();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onboarding = params.get('onboarding') === '1';
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  // sync local state when settings load
  const [synced, setSynced] = useState(false);
  if (!loading && !synced) {
    setLocal(settings);
    setSynced(true);
  }

  const setDailyHours = (h: number, m: number) => {
    setLocal(s => ({ ...s, dailyHours: h * 60 + m }));
  };

  const toggleDay = (day: number) => {
    setLocal(s => ({
      ...s,
      workDays: s.workDays.includes(day) ? s.workDays.filter(d => d !== day) : [...s.workDays, day].sort(),
    }));
  };

  const addDefaultPunch = () => {
    setLocal(s => ({ ...s, defaultPunches: [...s.defaultPunches, '08:00'] }));
  };

  const removeDefaultPunch = (i: number) => {
    setLocal(s => ({ ...s, defaultPunches: s.defaultPunches.filter((_, idx) => idx !== i) }));
  };

  const updateDefaultPunch = (i: number, v: string) => {
    setLocal(s => ({ ...s, defaultPunches: s.defaultPunches.map((p, idx) => idx === i ? v : p) }));
  };

  const punchesValid = local.defaultPunches.length >= MIN_PUNCHES;

  const handleSave = async () => {
    if (onboarding && !punchesValid) return;
    await update(local);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      if (onboarding) navigate('/', { replace: true });
    }, 800);
  };

  const h = Math.floor(local.dailyHours / 60);
  const m = local.dailyHours % 60;
  const offset = local.clockOffsetMinutes ?? 0;

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      <h1 className="mb-2 text-xl font-bold">Configurações</h1>
      {onboarding && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p className="text-foreground">
            Bem-vindo! Para começar, configure pelo menos <strong>{MIN_PUNCHES} batidas padrão</strong> que correspondem ao seu expediente.
          </p>
        </div>
      )}

      {/* Daily hours */}
      <section className="mb-6 rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold mb-3">Carga horária diária</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Horas</label>
            <input type="number" value={h} onChange={e => setDailyHours(parseInt(e.target.value || '0'), m)} min="0" max="24" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Minutos</label>
            <input type="number" value={m} onChange={e => setDailyHours(h, parseInt(e.target.value || '0'))} min="0" max="59" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Clock offset */}
      <section className="mb-6 rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold mb-1">Ajuste do relógio de ponto</p>
        <p className="text-xs text-muted-foreground mb-3">
          Compensa diferença entre o relógio do celular e o relógio de ponto da empresa.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={offset >= 0 ? 'ahead' : 'behind'}
            onChange={e => setLocal(s => ({ ...s, clockOffsetMinutes: e.target.value === 'ahead' ? Math.abs(offset) : -Math.abs(offset) }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="ahead">Adiantado</option>
            <option value="behind">Atrasado</option>
          </select>
          <input
            type="number"
            min="0"
            max="60"
            value={Math.abs(offset)}
            onChange={e => {
              const n = parseInt(e.target.value || '0');
              setLocal(s => ({ ...s, clockOffsetMinutes: offset >= 0 ? n : -n }));
            }}
            className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>
        {offset !== 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Cada batida será registrada {Math.abs(offset)} min {offset > 0 ? 'antes' : 'depois'} da hora real do celular.
          </p>
        )}
      </section>

      {/* Work days */}
      <section className="mb-6 rounded-xl bg-card border border-border p-4">
        <p className="text-sm font-semibold mb-3">Dias trabalhados</p>
        <div className="flex gap-2">
          {WEEKDAYS.map((name, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                local.workDays.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {/* Default punches */}
      <section className="mb-6 rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">Batidas padrão</p>
            {onboarding && (
              <p className={`text-xs mt-0.5 ${punchesValid ? 'text-success' : 'text-destructive'}`}>
                {local.defaultPunches.length}/{MIN_PUNCHES} batidas
              </p>
            )}
          </div>
          <button onClick={addDefaultPunch} className="flex items-center gap-1 text-sm text-primary font-medium">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {local.defaultPunches.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <input type="time" value={p} onChange={e => updateDefaultPunch(i, e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button onClick={() => removeDefaultPunch(i)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={onboarding && !punchesValid}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground mb-4 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saved ? 'Salvo!' : onboarding ? 'Concluir configuração' : 'Salvar Configurações'}
      </button>

      {/* Account */}
      {!onboarding && (
        <section className="rounded-xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-2">Conta: {user?.email}</p>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-destructive font-medium">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </section>
      )}
    </div>
  );
}
