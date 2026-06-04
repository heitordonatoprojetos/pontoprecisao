/**
 * Boot-time cache cleanup: limpa caches/Service Workers e recarrega o app
 * APENAS UMA VEZ por versão. Usa localStorage como flag para evitar loop.
 *
 * Preserva tokens do Supabase (chaves "sb-*" e "*supabase*").
 */
import { APP_VERSION } from './version';

const FLAG_KEY = 'pc:boot_cleared_for';

export async function bootRefreshOnce(): Promise<void> {
  try {
    if (localStorage.getItem(FLAG_KEY) === APP_VERSION) return;
  } catch {
    return;
  }

  // Marca ANTES de qualquer ação para garantir que não haja loop mesmo se algo falhar.
  try {
    localStorage.setItem(FLAG_KEY, APP_VERSION);
  } catch {
    return;
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      // Não remove o push-sw (mantém push em background funcionando)
      await Promise.all(
        regs.map(r => {
          const url = r.active?.scriptURL || '';
          if (url.includes('push-sw.js')) return Promise.resolve(true);
          return r.unregister();
        }),
      );
    }
  } catch {
    /* noop */
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_b', Date.now().toString());
  window.location.replace(url.toString());
}
