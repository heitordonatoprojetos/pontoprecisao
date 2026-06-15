/**
 * Pequeno módulo offline: escuta `online` e dispara `pc:online` no window.
 * Hooks de leitura escutam e fazem refresh para atualizar o BD local.
 */
const EVENT = 'pc:online';

export function emitOnline() {
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* noop */ }
}

export function installOfflineSync() {
  if (typeof window === 'undefined') return;
  const handler = () => {
    if (navigator.onLine) emitOnline();
  };
  window.addEventListener('online', handler);
}

export function onReconnect(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
