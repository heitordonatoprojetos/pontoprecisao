/**
 * Shared utilities to clear caches/service workers and reload the app
 * with a cache-busted URL. Preserves Supabase auth tokens.
 */

const PENDING_KEY = 'app_update_pending_version';
const ATTEMPT_TS_KEY = 'app_update_attempt_ts';
const MIN_RETRY_MS = 30 * 1000; // avoid tight reload loops

export function getPendingUpdateVersion(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingUpdate() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
    sessionStorage.removeItem(ATTEMPT_TS_KEY);
  } catch {/* noop */}
}

/** Returns true if it is safe to attempt an automatic reload now. */
export function canAttemptAutoUpdate(targetVersion: string): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY);
    const ts = parseInt(sessionStorage.getItem(ATTEMPT_TS_KEY) || '0');
    // Already tried for this version recently — don't loop.
    if (pending === targetVersion && Date.now() - ts < MIN_RETRY_MS * 10) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function clearAppCacheAndReload(targetVersion?: string) {
  try {
    if (targetVersion) {
      sessionStorage.setItem(PENDING_KEY, targetVersion);
      sessionStorage.setItem(ATTEMPT_TS_KEY, Date.now().toString());
    }
  } catch {/* noop */}

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
