import { useState, useMemo } from 'react';
import { Plus, Minus, Trash2, Wallet, FileDown, FileSpreadsheet, CalendarPlus, X, Palmtree } from 'lucide-react';
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
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showAllDays, setShowAllDays] = useState(false);
  const [exportPicker, setExportPicker] = useState<null | 'pdf' | 'xlsx'>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);


  // Modal de marcar dia como feriado/abono
  const [markingDate, setMarkingDate] = useState<string | null>(null);
  const [markDesc, setMarkDesc] = useState('Feriado');
  const [markSaving, setMarkSaving] = useState(false);

  // Modal de férias
  const [showVacation, setShowVacation] = useState(false);
  const [vacStart, setVacStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [vacEnd, setVacEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [vacDesc, setVacDesc] = useState('Férias');
  const [vacSaving, setVacSaving] = useState(false);

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
      const dayAdj = adjByDate[date] || [];
      // Marcador de dia abonado (férias/feriado/folga): adjustment com minutes === 0.
      // Esses dias "zeram" o saldo do dia — não esperam jornada nem somam ajuste.
      const isDayOff = dayAdj.some(a => a.minutes === 0);
      const expected = isDayOff ? 0 : (isWorkDay ? settings.dailyHours : 0);
      const adjMinutes = dayAdj.reduce((s, a) => s + a.minutes, 0);
      const punchTimes = dayPunches.map(p =>
        new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      );
      const adjDescriptions = dayAdj.map(a => a.description);
      return {
        date,
        dateFmt: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR'),
        dow,
        isWorkDay: isWorkDay && !isDayOff,
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

  /**
   * Saldo da jornada considerando apenas dias ANTERIORES ao dia atual.
   * O dia em andamento é tratado como "em aberto" para não tornar o saldo
   * negativo antes da jornada terminar.
   */
  const workedBalance = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dayRows
      .filter(r => r.date < today)
      .reduce((sum, r) => sum + (r.worked - r.expected), 0);
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
    const dateFmt = new Date(adjDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const confirmMsg = `Confirmar ${label} de ${Math.floor(totalMins / 60)}h${String(totalMins % 60).padStart(2, '0')} em ${dateFmt}?`;
    if (!confirm(confirmMsg)) return;
    await add(final, desc || (showForm === 'credit' ? 'Abono' : 'Débito'), adjDate);
    setShowForm(null);
    setHours(''); setMins(''); setDesc('');
    setAdjDate(new Date().toISOString().split('T')[0]);
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

  /** Conta quantos dias úteis (workDays) existem entre start e end (inclusive). */
  const vacationWorkDays = useMemo(() => {
    if (!showVacation || vacStart > vacEnd) return [];
    return eachDayBetween(vacStart, vacEnd).filter(d => {
      const dow = new Date(d + 'T12:00:00').getDay();
      return settings.workDays.includes(dow);
    });
  }, [showVacation, vacStart, vacEnd, settings.workDays]);

  const submitVacation = async () => {
    if (vacStart > vacEnd) return;
    const days = vacationWorkDays;
    if (days.length === 0) {
      alert('Nenhum dia útil no período selecionado.');
      return;
    }
    const startFmt = new Date(vacStart + 'T12:00:00').toLocaleDateString('pt-BR');
    const endFmt = new Date(vacEnd + 'T12:00:00').toLocaleDateString('pt-BR');
    if (!confirm(`Adicionar férias de ${startFmt} a ${endFmt}?\n${days.length} dia(s) útil(eis) serão abonados com ${formatMinutes(settings.dailyHours)} cada.`)) return;
    setVacSaving(true);
    for (const d of days) {
      await add(settings.dailyHours, vacDesc || 'Férias', d);
    }
    setVacSaving(false);
    setShowVacation(false);
  };

  /** Lista de meses disponíveis (YYYY-MM) com base nas batidas + ajustes. */
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    dayRows.forEach(r => set.add(r.date.slice(0, 7)));
    adjustments.forEach(a => set.add(a.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [dayRows, adjustments]);

  const monthLabel = (ym: string) =>
    new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const openExport = (kind: 'pdf' | 'xlsx') => {
    setSelectedMonths(availableMonths.slice(0, 1));
    setExportPicker(kind);
  };

  const toggleMonth = (m: string) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const filteredRows = (months: string[]) =>
    months.length === 0 ? dayRows : dayRows.filter(r => months.includes(r.date.slice(0, 7)));
  const filteredAdj = (months: string[]) =>
    months.length === 0 ? adjustments : adjustments.filter(a => months.includes(a.date.slice(0, 7)));

  const exportPDF = (months: string[]) => {
    const rows = filteredRows(months);
    const adj = filteredAdj(months);
    const total = rows.reduce((s, r) => s + r.balance, 0);
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Banco de Horas - Relatório', 14, 18);
    doc.setFontSize(10);
    const periodo = months.length === 0 ? 'Todos os períodos' : months.map(monthLabel).join(', ');
    doc.text(`Período: ${periodo}`, 14, 26);
    doc.text(`Saldo do período: ${total > 0 ? '+' : ''}${formatMinutes(total)}`, 14, 32);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 38);
    autoTable(doc, {
      startY: 44,
      head: [['Data', 'Batidas', 'Trabalhado', 'Esperado', 'Ajuste', 'Saldo']],
      body: rows.map(r => [
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
    if (adj.length > 0) {
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Minutos']],
        body: adj.map(a => [
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

  const exportXLSX = (months: string[]) => {
    const rows = filteredRows(months);
    const adj = filteredAdj(months);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Data: r.dateFmt,
      Batidas: r.hasPunches ? r.punchTimes.join(' | ') : '',
      Ajuste: r.adjDescriptions.join(', '),
      Trabalhado: formatMinutes(r.worked),
      Esperado: formatMinutes(r.expected),
      MinutosAjuste: r.adjMinutes,
      Saldo: (r.balance > 0 ? '+' : '') + formatMinutes(r.balance),
    })));
    XLSX.utils.book_append_sheet(wb, ws, 'Dias');
    if (adj.length > 0) {
      const wsAdj = XLSX.utils.json_to_sheet(adj.map(a => ({
        Data: new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR'),
        Descrição: a.description,
        Minutos: a.minutes,
        Formatado: (a.minutes > 0 ? '+' : '') + formatMinutes(a.minutes),
      })));
      XLSX.utils.book_append_sheet(wb, wsAdj, 'Ajustes');
    }
    XLSX.writeFile(wb, `banco-horas-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const confirmExport = () => {
    if (!exportPicker) return;
    if (exportPicker === 'pdf') exportPDF(selectedMonths);
    else exportXLSX(selectedMonths);
    setExportPicker(null);
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
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          <span>Jornada: {formatMinutes(workedBalance)}</span>
          <span>•</span>
          <span>Ajustes: {formatMinutes(adjustmentTotal)}</span>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          O dia em andamento não é contabilizado até a jornada terminar.
        </p>
      </div>

      {/* Action buttons */}
      <div className="mb-3 flex gap-3">
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
      <div className="mb-6">
        <button
          onClick={() => setShowVacation(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          <Palmtree className="h-4 w-4" /> Adicionar férias
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
          <div>
            <label className="text-xs text-muted-foreground">Data</label>
            <input
              type="date"
              value={adjDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setAdjDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
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
          onClick={() => openExport('pdf')}
          disabled={dayRows.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" /> Baixar PDF
        </button>
        <button
          onClick={() => openExport('xlsx')}
          disabled={dayRows.length === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> Baixar XLSX
        </button>
      </div>

      {/* History (ajustes manuais primeiro - mais relevantes nesta aba) */}
      <p className="mb-2 text-sm font-medium text-muted-foreground">Ajustes manuais</p>
      {adjustments.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum ajuste registrado</p>}
      <div className="space-y-2 mb-6">
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

      {/* Days list (últimos 7 por padrão) */}
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Últimas batidas {!showAllDays && dayRows.length > 7 && <span className="text-xs">(7 mais recentes)</span>}
      </p>
      {dayRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem batidas registradas ainda</p>}
      <div className="space-y-2 mb-3">
        {(showAllDays ? dayRows : dayRows.slice(0, 7)).map(r => {
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
      {dayRows.length > 7 && (
        <button
          onClick={() => setShowAllDays(s => !s)}
          className="mb-6 w-full rounded-xl border border-border bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          {showAllDays ? 'Mostrar menos' : `Mostrar mais (${dayRows.length - 7})`}
        </button>
      )}

      {/* Modal: escolher meses para relatório */}
      {exportPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setExportPicker(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-base">
                Escolha os meses ({exportPicker.toUpperCase()})
              </p>
              <button onClick={() => setExportPicker(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 flex gap-2 text-xs">
              <button onClick={() => setSelectedMonths(availableMonths)} className="rounded-md border border-border px-2 py-1 hover:bg-secondary">Todos</button>
              <button onClick={() => setSelectedMonths([])} className="rounded-md border border-border px-2 py-1 hover:bg-secondary">Limpar</button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availableMonths.length === 0 && <p className="text-sm text-muted-foreground">Nenhum mês disponível.</p>}
              {availableMonths.map(m => (
                <label key={m} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-secondary cursor-pointer text-sm capitalize">
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(m)}
                    onChange={() => toggleMonth(m)}
                    className="h-4 w-4"
                  />
                  {monthLabel(m)}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedMonths.length === 0 ? 'Nenhum selecionado = exportar tudo.' : `${selectedMonths.length} mês(es) selecionado(s).`}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setExportPicker(null)}
                className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Cancelar
              </button>
              <button
                onClick={confirmExport}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal: férias */}
      {showVacation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !vacSaving && setShowVacation(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-base flex items-center gap-2">
                <Palmtree className="h-4 w-4 text-primary" /> Adicionar férias
              </p>
              <button onClick={() => setShowVacation(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Todos os dias úteis do período serão abonados automaticamente.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Início</label>
                <input
                  type="date"
                  value={vacStart}
                  onChange={e => setVacStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Fim</label>
                <input
                  type="date"
                  value={vacEnd}
                  onChange={e => setVacEnd(e.target.value)}
                  min={vacStart}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <input
                type="text"
                value={vacDesc}
                onChange={e => setVacDesc(e.target.value)}
                placeholder="Férias"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {vacStart > vacEnd
                ? <span className="text-destructive">Data de fim deve ser maior ou igual ao início.</span>
                : <>Serão criados <span className="font-semibold text-foreground">{vacationWorkDays.length}</span> abono(s) de <span className="font-semibold text-foreground">+{formatMinutes(settings.dailyHours)}</span> cada.</>}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowVacation(false)}
                disabled={vacSaving}
                className="flex-1 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitVacation}
                disabled={vacSaving || vacStart > vacEnd || vacationWorkDays.length === 0}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {vacSaving ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
