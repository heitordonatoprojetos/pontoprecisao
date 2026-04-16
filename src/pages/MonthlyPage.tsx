import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAllPunches, useSettings, calculateWorkedMinutes, formatMinutes, type Punch } from '@/hooks/useDB';

export default function MonthlyPage() {
  const { punches } = useAllPunches();
  const { settings } = useSettings();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [year, mon] = month.split('-').map(Number);

  const daysInMonth = useMemo(() => {
    const days: { date: string; worked: number; expected: number; balance: number }[] = [];
    const numDays = new Date(year, mon, 0).getDate();
    const byDate: Record<string, Punch[]> = {};
    punches.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = [];
      byDate[p.date].push(p);
    });

    let totalWorked = 0, totalExpected = 0;
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayPunches = byDate[dateStr] || [];
      const dow = new Date(dateStr + 'T12:00:00').getDay();
      const isWork = settings.workDays.includes(dow);
      const worked = calculateWorkedMinutes(dayPunches);
      const expected = isWork ? settings.dailyHours : 0;
      totalWorked += worked;
      totalExpected += expected;
      if (dayPunches.length > 0 || isWork) {
        days.push({ date: dateStr, worked, expected, balance: worked - expected });
      }
    }

    return { days, totalWorked, totalExpected, totalBalance: totalWorked - totalExpected };
  }, [punches, settings, year, mon]);

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = new Date(year, mon - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><ChevronLeft className="h-5 w-5" /></button>
        <p className="text-lg font-semibold capitalize">{monthLabel}</p>
        <button onClick={nextMonth} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Trabalhado</p>
          <p className="text-lg font-bold tabular-nums">{formatMinutes(daysInMonth.totalWorked)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Esperado</p>
          <p className="text-lg font-bold tabular-nums">{formatMinutes(daysInMonth.totalExpected)}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-lg font-bold tabular-nums ${daysInMonth.totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatMinutes(daysInMonth.totalBalance)}
          </p>
        </div>
      </div>

      {/* Days list */}
      <div className="space-y-2">
        {daysInMonth.days.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro neste mês</p>
        )}
        {daysInMonth.days.map(d => {
          const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
          return (
            <div key={d.date} className="flex items-center justify-between rounded-xl bg-card border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium capitalize">{dayLabel}</p>
                <p className="text-xs text-muted-foreground">{formatMinutes(d.worked)} / {formatMinutes(d.expected)}</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${d.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {d.balance > 0 ? '+' : ''}{formatMinutes(d.balance)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
