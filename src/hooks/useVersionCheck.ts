import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/lib/version';
import {
  canAttemptAutoUpdate,
  clearAppCacheAndReload,
  clearPendingUpdate,
  getPendingUpdateVersion,
} from '@/lib/appUpdate';

const CHECK_INTERVAL_MS = 60 * 1000; // 1 min

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * Compara a versão do bundle (APP_VERSION) com /version.json publicado.
 * Quando há nova versão:
 *  - tenta atualizar automaticamente (limpando cache/SW e recarregando);
 *  - se o auto-update já foi tentado para essa versão, expõe `remoteVersion`
 *    para que um banner manual seja mostrado (evita loop).
 */
export function useVersionCheck() {
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    // Bundle agora bate com a versão pendente: update concluído.
    if (getPendingUpdateVersion() === APP_VERSION) {
      clearPendingUpdate();
    }

    let cancelled = false;

    const check = async () => {
      const v = await fetchRemoteVersion();
      if (cancelled) return;

      if (!v) return;

      if (v === APP_VERSION) {
        clearPendingUpdate();
        setRemoteVersion(null);
        return;
      }

      // Há nova versão. Tenta auto-update silencioso uma única vez por versão.
      if (canAttemptAutoUpdate(v)) {
        clearAppCacheAndReload(v);
        return;
      }

      // Já tentou — mostra o banner manual.
      setRemoteVersion(v);
    };

    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onFocus);

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, []);

  return { remoteVersion, currentVersion: APP_VERSION };
}
