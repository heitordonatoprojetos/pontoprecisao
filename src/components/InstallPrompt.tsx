import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    // Skip in iframe (Lovable preview)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    // Recently dismissed?
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const safari = iOS && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);

    if (iOS && safari) {
      setIsIOS(true);
      setOpen(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-24 md:pb-4 animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Instalar o app</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isIOS
                ? 'Acesse mais rápido adicionando à sua tela de início.'
                : 'Tenha acesso rápido e use offline na sua tela de início.'}
            </p>

            {isIOS ? (
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>1. Toque em</span>
                  <Share className="h-3.5 w-3.5" />
                  <span>(Compartilhar)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>2. Escolha</span>
                  <Plus className="h-3.5 w-3.5" />
                  <span>"Adicionar à Tela de Início"</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={install}
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Instalar
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
                >
                  Agora não
                </button>
              </div>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
