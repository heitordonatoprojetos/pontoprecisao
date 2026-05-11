import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = ['/', '/diario', '/mensal', '/banco', '/config'];

export function useSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let startX = 0, startY = 0, startT = 0, tracking = false;

    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest('input,select,textarea,button,a,[data-no-swipe],[role="dialog"],[role="slider"]')) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startT = Date.now();
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startT;
      if (dt > 600) return;
      if (Math.abs(dx) < 70) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.6) return;

      const idx = TABS.indexOf(location.pathname);
      if (idx === -1) return;
      const nextIdx = dx < 0 ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= TABS.length) return;
      navigate(TABS[nextIdx]);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [navigate, location.pathname]);
}
