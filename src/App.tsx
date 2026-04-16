import { useRef, type TouchEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import HomePage from '@/pages/HomePage';
import DailyPage from '@/pages/DailyPage';
import MonthlyPage from '@/pages/MonthlyPage';
import BankPage from '@/pages/BankPage';
import SettingsPage from '@/pages/SettingsPage';
import AuthPage from '@/pages/AuthPage';
import NotFound from './pages/NotFound.tsx';

const queryClient = new QueryClient();
const swipeTabs = ['/', '/diario', '/mensal', '/banco', '/config'];

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, [data-no-swipe]')) {
      touchStartRef.current = null;
      return;
    }

    const t = event.changedTouches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const t = event.changedTouches[0];
    const deltaX = t.clientX - start.x;
    const deltaY = t.clientY - start.y;

    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const currentIndex = swipeTabs.indexOf(location.pathname);
    if (currentIndex === -1) return;

    if (deltaX < 0 && currentIndex < swipeTabs.length - 1) {
      navigate(swipeTabs[currentIndex + 1]);
    }

    if (deltaX > 0 && currentIndex > 0) {
      navigate(swipeTabs[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/diario" element={<DailyPage />} />
          <Route path="/mensal" element={<MonthlyPage />} />
          <Route path="/banco" element={<BankPage />} />
          <Route path="/config" element={<SettingsPage />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="mx-auto max-w-lg">
            <AppRoutes />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
