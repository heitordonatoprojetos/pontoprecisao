import { useEffect, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

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
 * Retorna a versão remota se for diferente da atual, ou null caso contrário.
 */
export function useVersionCheck() {
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const v = await fetchRemoteVersion();
      if (!cancelled && v && v !== APP_VERSION) setRemoteVersion(v);
      else if (!cancelled && v === APP_VERSION) setRemoteVersion(null);
    };

    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return { remoteVersion, currentVersion: APP_VERSION };
}
