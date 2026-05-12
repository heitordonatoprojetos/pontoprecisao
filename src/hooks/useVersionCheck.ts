import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/lib/version';
import {
  canAttemptAutoUpdate,
  clearAppCacheAndReload,
  clearPendingUpdate,
  getPendingUpdateVersion,
} from '@/lib/appUpdate';

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
 * Verifica a versão somente quando o app é aberto / volta ao primeiro plano.
 * Sem polling. Se houver nova versão, limpa cache e recarrega automaticamente.
 * Se o auto-update já foi tentado para a mesma versão, expõe `remoteVersion`
 * para um banner manual (evita loops).
 */
export function useVersionCheck() {
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    if (getPendingUpdateVersion() === APP_VERSION) {
      clearPendingUpdate();
      setTimeout(() => {
        toast.success(`Atualizado para v${APP_VERSION}`, {
          description: 'O app foi atualizado com as últimas melhorias.',
          duration: 5000,
        });
      }, 600);
    }

    let cancelled = false;

    const check = async () => {
      const v = await fetchRemoteVersion();
      if (cancelled || !v) return;

      if (v === APP_VERSION) {
        clearPendingUpdate();
        setRemoteVersion(null);
        return;
      }

      if (canAttemptAutoUpdate(v)) {
        clearAppCacheAndReload(v);
        return;
      }

      setRemoteVersion(v);
    };

    // Executa apenas na abertura do app e quando o app volta a ficar visível
    // (ex.: PWA reaberto, aba retomada).
    check();

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { remoteVersion, currentVersion: APP_VERSION };
}
