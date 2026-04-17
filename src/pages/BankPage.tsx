import { useState, useMemo } from 'react';
import { Plus, Minus, Trash2, Wallet, FileDown, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAdjustments, useAllPunches, useSettings, calculateWorkedMinutes, formatMinutes } from '@/hooks/useDB';

export default function BankPage() {
  const { adjustments, add, remove } = useAdjustments();
  const { punches } = useAllPunches();
  const { settings } = useSettings();
  const [showForm, setShowForm] = useState<'credit' | 'debit' | null>(null);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [desc, setDesc] = useState('');

  const workedBalance = useMemo(() => {
    const byDate: Record<string, typeof punches> = {};
    punches.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = [];
      byDate[p.date].push(p);
    });
    let total = 0;
    Object.entries(byDate).forEach(([date, dayPunches]) => {
      const dow = new Date(date + 'T12:00:00').getDay();
      const isWork = settings.workDays.includes(dow);
      const worked = calculateWorkedMinutes(dayPunches);
      const expected = isWork ? settings.dailyHours : 0;
      total += worked - expected;
    });
    return total;
  }, [punches, settings]);

  const adjustmentTotal = adjustments.reduce((s, a) => s + a.minutes, 0);
  const totalBalance = workedBalance + adjustmentTotal;

  const handleSubmit = async () => {
    const totalMins = (parseInt(hours || '0') * 60) + parseInt(mins || '0');
    if (totalMins <= 0) return;
    const final = showForm === 'debit' ? -totalMins : totalMins;
    await add(final, desc || (showForm === 'credit' ? 'Abono' : 'Débito'));
    setShowForm(null);
    setHours(''); setMins(''); setDesc('');
  };

  const buildRows = () => {
    const byDate: Record<string, typeof punches> = {};
    punches.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = [];
      byDate[p.date].push(p);
    });
    return Object.keys(byDate).sort().reverse().map(date => {
      const day = byDate[date].sort((a, b) => a.timestamp - b.timestamp);
      const times = day.map(p =>
        new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
      const dow = new Date(date + 'T12:00:00').getDay();
      const isWork = settings.workDays.includes(dow);
      const worked = calculateWorkedMinutes(day);
      const expected = isWork ? settings.dailyHours : 0;
      const balance = worked - expected;
      return {
        dateFmt: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR'),
        punches: times.join(' | '),
        worked: formatMinutes(worked),
        expected: formatMinutes(expected),
        balance: (balance > 0 ? '+' : '') + formatMinutes(balance),
      };
    });
  };

  const exportPDF = () => {
    const rows = buildRows();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Banco de Horas - Relatório', 14, 18);
    doc.setFontSize(10);
    doc.text(`Saldo total: ${totalBalance > 0 ? '+' : ''}${formatMinutes(totalBalance)}`, 14, 26);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [['Data', 'Batidas', 'Trabalhado', 'Esperado', 'Saldo']],
      body: rows.map(r => [r.dateFmt, r.punches, r.worked, r.expected, r.balance]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    if (adjustments.length > 0) {
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Minutos']],
        body: adjustments.map(a => [
          new Date(a.createdAt).toLocaleDateString('pt-BR'),
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
    const rows = buildRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Data: r.dateFmt,
      Batidas: r.punches,
      Trabalhado: r.worked,
      Esperado: r.expected,
      Saldo: r.balance,
    })));
    XLSX.utils.book_append_sheet(wb, ws, 'Batidas');
    if (adjustments.length > 0) {
      const wsAdj = XLSX.utils.json_to_sheet(adjustments.map(a => ({
        Data: new Date(a.createdAt).toLocaleDateString('pt-BR'),
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

      {/* History */}
      <p className="mb-2 text-sm font-medium text-muted-foreground">Histórico de ajustes</p>
      {adjustments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ajuste registrado</p>}
      <div className="space-y-2">
        {adjustments.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">{a.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${a.minutes >= 0 ? 'text-success' : 'text-destructive'}`}>
                {a.minutes > 0 ? '+' : ''}{formatMinutes(a.minutes)}
              </span>
              <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
