import { useState, useMemo } from 'react';
import { Plus, Minus, Trash2, Wallet, FileDown, FileSpreadsheet, CalendarPlus, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAdjustments, useAllPunches, useSettings, calculateWorkedMinutes, formatMinutes } from '@/hooks/useDB';


interface DayRow {
  date: string;            // YYYY-MM-DD
  dateFmt: string;         // dd/mm/aaaa
  dow: number;             // 0..6
  isWorkDay: boolean;
  hasPunches: boolean;
  punchTimes: string[];
  worked: number;          // minutos trabalhados via batidas
  expected: number;        // minutos esperados (0 se não-útil)
  adjMinutes: number;      // soma de ajustes daquele dia
  adjDescriptions: string[];
  balance: number;         // worked - expected + adjMinutes
}

function eachDayBetween(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const cur = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export default function BankPage() {
  const { adjustments, add, remove } = useAdjustments();
  const { punches, refresh: refreshPunches } = useAllPunches();
  const { settings } = useSettings();
  const [showForm, setShowForm] = useState<'credit' | 'debit' | null>(null);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [desc, setDesc] = useState('');
  const [showAllDays, setShowAllDays] = useState(false);
  const [exportPicker, setExportPicker] = useState<null | 'pdf' | 'xlsx'>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);


  // Modal de marcar dia como feriado/abono
  const [markingDate, setMarkingDate] = useState<string | null>(null);
  const [markDesc, setMarkDesc] = useState('Feriado');
  const [markSaving, setMarkSaving] = useState(false);

  /** Linhas de dias (do primeiro dia com batida até hoje) */
  const dayRows = useMemo<DayRow[]>(() => {
    if (punches.length === 0) return [];

    // Indexa batidas por data
    const punchesByDate: Record<string, typeof punches> = {};
    punches.forEach(p => {
      if (!punchesByDate[p.date]) punchesByDate[p.date] = [];
      punchesByDate[p.date].push(p);
    });

    // Indexa ajustes por data (por date e não createdAt)
    const adjByDate: Record<string, typeof adjustments> = {};
    adjustments.forEach(a => {
      if (!adjByDate[a.date]) adjByDate[a.date] = [];
      adjByDate[a.date].push(a);
    });

    // Primeira batida = data mais antiga
    const firstDate = Object.keys(punchesByDate).sort()[0];
    const today = new Date().toISOString().split('T')[0];

    const allDates = eachDayBetween(firstDate, today);

    return allDates.map(date => {
      const dayPunches = (punchesByDate[date] || []).sort((a, b) => a.timestamp - b.timestamp);
      const hasPunches = dayPunches.length > 0;
      const dow = new Date(date + 'T12:00:00').getDay();
      const isWorkDay = settings.workDays.includes(dow);
      const worked = hasPunches ? calculateWorkedMinutes(dayPunches) : 0;
      const expected = isWorkDay ? settings.dailyHours : 0;
      const dayAdj = adjByDate[date] || [];
      const adjMinutes = dayAdj.reduce((s, a) => s + a.minutes, 0);
      const punchTimes = dayPunches.map(p =>
        new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      );
      const adjDescriptions = dayAdj.map(a => a.description);
      return {
        date,
        dateFmt: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR'),
        dow,
        isWorkDay,
        hasPunches,
        punchTimes,
        worked,
        expected,
        adjMinutes,
        adjDescriptions,
        balance: worked - expected + adjMinutes,
      };
    }).reverse(); // mais recente primeiro
  }, [punches, adjustments, settings]);

  /** Saldo da jornada considerando dias faltantes desde a primeira batida */
  const workedBalance = useMemo(() => {
    return dayRows.reduce((sum, r) => sum + (r.worked - r.expected), 0);
  }, [dayRows]);

  const adjustmentTotal = useMemo(
    () => adjustments.reduce((s, a) => s + a.minutes, 0),
    [adjustments],
  );
  const totalBalance = workedBalance + adjustmentTotal;

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async () => {
    const totalMins = (parseInt(hours || '0') * 60) + parseInt(mins || '0');
    if (totalMins <= 0) return;
    const final = showForm === 'debit' ? -totalMins : totalMins;
    const label = showForm === 'credit' ? 'abono' : 'débito';
    const confirmMsg = `Confirmar ${label} de ${Math.floor(totalMins / 60)}h${String(totalMins % 60).padStart(2, '0')} no banco de horas?`;
    if (!confirm(confirmMsg)) return;
    await add(final, desc || (showForm === 'credit' ? 'Abono' : 'Débito'));
    setShowForm(null);
    setHours(''); setMins(''); setDesc('');
  };

  const handleRemoveAdjustment = async (id: string) => {
    if (!confirm('Excluir este ajuste do banco de horas?')) return;
    await remove(id);
  };

  const openMark = (date: string) => {
    setMarkingDate(date);
    setMarkDesc('Feriado');
  };

  const submitMark = async () => {
    if (!markingDate) return;
    setMarkSaving(true);
    await add(settings.dailyHours, markDesc || 'Feriado', markingDate);
    setMarkingDate(null);
    setMarkSaving(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Banco de Horas - Relatório', 14, 18);
    doc.setFontSize(10);
    doc.text(`Saldo total: ${totalBalance > 0 ? '+' : ''}${formatMinutes(totalBalance)}`, 14, 26);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [['Data', 'Batidas', 'Trabalhado', 'Esperado', 'Ajuste', 'Saldo']],
      body: dayRows.map(r => [
        r.dateFmt,
        r.hasPunches ? r.punchTimes.join(' | ') : (r.adjDescriptions.length ? r.adjDescriptions.join(', ') : '—'),
        formatMinutes(r.worked),
        formatMinutes(r.expected),
        r.adjMinutes ? (r.adjMinutes > 0 ? '+' : '') + formatMinutes(r.adjMinutes) : '—',
        (r.balance > 0 ? '+' : '') + formatMinutes(r.balance),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    if (adjustments.length > 0) {
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Minutos']],
        body: adjustments.map(a => [
          new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR'),
          a.description,
          (a.minutes > 0 ? '+' : '') + formatMinutes(a.minutes),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }
    doc.save(`banco-horas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dayRows.map(r => ({
      Data: r.dateFmt,
      Batidas: r.hasPunches ? r.punchTimes.join(' | ') : '',
      Ajuste: r.adjDescriptions.join(', '),
      Trabalhado: formatMinutes(r.worked),
      Esperado: formatMinutes(r.expected),
      MinutosAjuste: r.adjMinutes,
      Saldo: (r.balance > 0 ? '+' : '') + formatMinutes(r.balance),
    })));
    XLSX.utils.book_append_sheet(wb, ws, 'Dias');
    if (adjustments.length > 0) {
      const wsAdj = XLSX.utils.json_to_sheet(adjustments.map(a => ({
        Data: new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR'),
        Descrição: a.description,
        Minutos: a.minutes,
        Formatado: (a.minutes > 0 ? '+' : '') + formatMinutes(a.minutes),
      })));
      XLSX.utils.book_append_sheet(wb, wsAdj, 'Ajustes');
    }
    XLSX.writeFile(wb, `banco-horas-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      <h1 className="mb-6 text-xl font-bold">Banco de Horas</h1>

      {/* Balance card */}
      <div className="mb-6 rounded-2xl bg-card border border-border p-6 text-center">
        <Wallet className="mx-auto mb-2 h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Saldo atual</p>
        <p className={`text-4xl font-bold tabular-nums ${totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
          {totalBalance > 0 ? '+' : ''}{formatMinutes(totalBalance)}
        </p>
        <div className="mt-3 flex justify-center gap-2 text-xs text-muted-foreground">
          <span>Jornada: {formatMinutes(workedBalance)}</span>
          <span>•</span>
          <span>Ajustes: {formatMinutes(adjustmentTotal)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setShowForm('credit')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-semibold text-success-foreground"
        >
          <Plus className="h-4 w-4" /> Abono
        </button>
        <button
          onClick={() => setShowForm('debit')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground"
        >
          <Minus className="h-4 w-4" /> Débito
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 rounded-xl bg-card border border-border p-4 space-y-3">
          <p className="font-medium text-sm">{showForm === 'credit' ? 'Adicionar Abono' : 'Adicionar Débito'}</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Horas</label>
              <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="0" min="0" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Minutos</label>
              <input type="number" value={mins} onChange={e => setMins(e.target.value)} placeholder="0" min="0" max="59" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground">Salvar</button>
            <button onClick={() => setShowForm(null)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={exportPDF}
          disabled={dayRows.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" /> Baixar PDF
        </button>
        <button
          onClick={exportXLSX}
          disabled={dayRows.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> Baixar XLSX
        </button>
      </div>

      {/* Days list */}
      <p className="mb-2 text-sm font-medium text-muted-foreground">Dias</p>
      {dayRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem batidas registradas ainda</p>}
      <div className="space-y-2 mb-6">
        {dayRows.map(r => {
          const isToday = r.date === todayStr;
          const missing = r.isWorkDay && !r.hasPunches && r.adjMinutes === 0 && !isToday;
          const balanceColor = r.balance >= 0 ? 'text-success' : 'text-destructive';
          return (
            <div key={r.date} className="rounded-xl bg-card border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.dateFmt}
                    {!r.isWorkDay && <span className="ml-2 text-xs text-muted-foreground">(folga)</span>}
                    {isToday && <span className="ml-2 text-xs text-primary">hoje</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.hasPunches
                      ? r.punchTimes.join(' • ')
                      : r.adjDescriptions.length
                        ? r.adjDescriptions.join(', ')
                        : missing
                          ? 'Sem batidas'
                          : '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${balanceColor}`}>
                    {r.balance > 0 ? '+' : ''}{formatMinutes(r.balance)}
                  </p>
                  {(r.expected > 0 || r.worked > 0) && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatMinutes(r.worked)} / {formatMinutes(r.expected)}
                    </p>
                  )}
                </div>
              </div>
              {missing && (
                <button
                  onClick={() => openMark(r.date)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Marcar como feriado/abono
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* History */}
      <p className="mb-2 text-sm font-medium text-muted-foreground">Histórico de ajustes</p>
      {adjustments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ajuste registrado</p>}
      <div className="space-y-2">
        {adjustments.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-sm font-bold tabular-nums ${a.minutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                {a.minutes > 0 ? '+' : ''}{formatMinutes(a.minutes)}
              </span>
              <button onClick={() => handleRemoveAdjustment(a.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: marcar como feriado/abono */}
      {markingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !markSaving && setMarkingDate(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-card border border-border p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-base">Marcar dia</p>
              <button onClick={() => setMarkingDate(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {new Date(markingDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <input
              type="text"
              value={markDesc}
              onChange={e => setMarkDesc(e.target.value)}
              placeholder="Feriado, Abono, Folga..."
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Será adicionado um abono de <span className="font-semibold text-foreground">+{formatMinutes(settings.dailyHours)}</span> neste dia.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setMarkingDate(null)}
                disabled={markSaving}
                className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitMark}
                disabled={markSaving}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {markSaving ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
