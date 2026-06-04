import { useEffect } from 'react';
import { useTodayPunches, useSettings } from '@/hooks/useDB';
import { clearReminder, scheduleReminder } from '@/lib/punchReminder';

/**
 * Hook leve: reagenda 1 timer sempre que batidas/configurações mudam.
 */
export function usePunchReminder() {
  const { punches } = useTodayPunches();
  const { settings, loading } = useSettings();

  useEffect(() => {
    if (loading) return;
    scheduleReminder(
      punches,
      settings.defaultPunches || [],
      settings.clockOffsetMinutes ?? 0,
      settings.reminderLeadMinutes ?? 1,
    );
    return clearReminder;
  }, [punches, settings.defaultPunches, settings.clockOffsetMinutes, settings.reminderLeadMinutes, loading]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !loading) {
        scheduleReminder(
          punches,
          settings.defaultPunches || [],
          settings.clockOffsetMinutes ?? 0,
          settings.reminderLeadMinutes ?? 1,
        );
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [punches, settings.defaultPunches, settings.clockOffsetMinutes, settings.reminderLeadMinutes, loading]);
}
