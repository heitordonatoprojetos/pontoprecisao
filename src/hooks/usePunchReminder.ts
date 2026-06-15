import { useEffect } from 'react';
import { useTodayPunches, useSettings } from '@/hooks/useDB';
import { clearReminder, scheduleReminder } from '@/lib/punchReminder';
import { isWebPushSupported, subscribeWebPush } from '@/lib/webPush';

/**
 * Hook leve: reagenda 1 timer sempre que batidas/configurações mudam.
 * Também re-assina web push se a configuração estiver ativa (sobrevive a limpar cache).
 */
export function usePunchReminder() {
  const { punches } = useTodayPunches();
  const { settings, loading } = useSettings();

  useEffect(() => {
    if (loading) return;
    if (!settings.notificationsEnabled) { clearReminder(); return; }
    scheduleReminder(
      punches,
      settings.defaultPunches || [],
      settings.clockOffsetMinutes ?? 0,
      settings.reminderLeadMinutes ?? 1,
    );
    return clearReminder;
  }, [punches, settings.defaultPunches, settings.clockOffsetMinutes, settings.reminderLeadMinutes, settings.notificationsEnabled, loading]);

  // Re-assina web push em background se o usuário ativou as notificações e
  // o navegador perdeu a inscrição (ex.: cache limpo).
  useEffect(() => {
    if (loading) return;
    if (!settings.notificationsEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!isWebPushSupported()) return;
    subscribeWebPush().catch(() => undefined);
  }, [settings.notificationsEnabled, loading]);

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
