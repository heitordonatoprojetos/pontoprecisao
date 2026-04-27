import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { getPunchesByDate, deletePunch, updatePunch, addPunch, calculateWorkedMinutes, formatMinutes, type Punch } from '@/hooks/useDB';
import { useSettings } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';

export default function DailyPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const { settings } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState<'in' | 'out'>('in');
  const [showAdd, setShowAdd] = useState(false);
  const [addTime, setAddTime] = useState('');
  const [addType, setAddType] = useState<'in' | 'out'>('in');

  const load = useCallback(async () => {
    if (!user) return;
    const p = await getPunchesByDate(user.id, date);
    setPunches(p);
  }, [date, user]);

  useEffect(() => { load(); }, [load]);

  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const isWorkDay = settings.workDays.includes(dayOfWeek);
  const worked = calculateWorkedMinutes(punches);
  const expected = isWorkDay ? settings.dailyHours : 0;
  const balance = worked - expected;

  const prev = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };
  const next = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleDelete = async (id: string) => {
    await deletePunch(id);
    await load();
  };

  const startEdit = (p: Punch) => {
    setEditingId(p.id);
    setEditTime(new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setEditType(p.type);
  };

  const saveEdit = async (p: Punch) => {
    const [h, m] = editTime.split(':').map(Number);
    const d = new Date(p.timestamp);
    d.setHours(h, m, 0, 0);
    await updatePunch(p.id, d.getTime(), editType);
    setEditingId(null);
    await load();
  };

  const cancelEdit = () => setEditingId(null);

  const handleAdd = async () => {
    if (!addTime || !user) return;
    const [h, m] = addTime.split(':').map(Number);
    const d = new Date(date + 'T12:00:00');
    d.setHours(h, m, 0, 0);
    await addPunch(user.id, {
      timestamp: d.getTime(),
      type: addType,
      date,
    });
    setShowAdd(false);
    setAddTime('');
    await load();
  };

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      {/* Date nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prev} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-center">
          <p className="text-lg font-semibold capitalize">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
        <button onClick={next} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Trabalhado</p>
          <p className="text-lg font-bold tabular-nums">{formatMinutes(worked)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Esperado</p>
          <p className="text-lg font-bold tabular-nums">{formatMinutes(expected)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-lg font-bold tabular-nums ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>{formatMinutes(balance)}</p>
        </div>
      </div>

      {/* Punches list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Batidas</p>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-sm text-primary font-medium">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        {showAdd && (
          <div className="rounded-xl bg-card border border-border p-3 flex items-center gap-2">
            <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
            <select value={addType} onChange={e => setAddType(e.target.value as 'in' | 'out')} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm">
              <option value="in">Entrada</option>
              <option value="out">Saída</option>
            </select>
            <button onClick={handleAdd} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">OK</button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-muted-foreground">✕</button>
          </div>
        )}

        {punches.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma batida registrada</p>}

        {punches.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="rounded-xl bg-card border border-border px-4 py-3">
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${editType === 'in' ? 'bg-primary' : 'bg-destructive'}`} />
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value as 'in' | 'out')}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Saída</option>
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => saveEdit(p)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Salvar</button>
                    <button onClick={cancelEdit} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${p.type === 'in' ? 'bg-primary' : 'bg-destructive'}`} />
                    <span className="font-medium tabular-nums">
                      {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.type === 'in' ? 'Entrada' : 'Saída'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(p)} className="rounded-lg p-2 text-muted-foreground hover:text-foreground" aria-label="Editar batida">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-muted-foreground hover:text-destructive" aria-label="Excluir batida">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
