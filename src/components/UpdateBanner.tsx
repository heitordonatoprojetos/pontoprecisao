import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useVersionCheck } from '@/hooks/useVersionCheck';

async function clearAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {/* noop */}
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.replace(url.toString());
}

export default function UpdateBanner() {
  const { remoteVersion, currentVersion } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!remoteVersion || dismissed) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[100] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-xl border border-primary/40 bg-card p-3 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Nova versão disponível</p>
          <p className="text-xs text-muted-foreground">
            v{currentVersion} → <span className="font-semibold text-foreground">v{remoteVersion}</span>. Atualize para ver as melhorias.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={clearAndReload}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Atualizar agora
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Depois
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
