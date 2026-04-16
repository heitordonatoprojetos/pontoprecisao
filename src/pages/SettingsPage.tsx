import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Clock } from 'lucide-react';
import { useSettings } from '@/hooks/useDB';
import type { AppSettings } from '@/lib/db';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function SettingsPage() {
  const { settings, update, loading } = useSettings();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading) setLocal(settings); }, [settings, loading]);

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

  const handleSave = async () => {
    await update(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const h = Math.floor(local.dailyHours / 60);
  const m = local.dailyHours % 60;

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      <h1 className="mb-6 text-xl font-bold">Configurações</h1>

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
          <p className="text-sm font-semibold">Batidas padrão</p>
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
      <button onClick={handleSave} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
        <Save className="h-4 w-4" />
        {saved ? 'Salvo!' : 'Salvar Configurações'}
      </button>
    </div>
  );
}
