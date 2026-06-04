import { useEffect, useState, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import UpdateBanner from "@/components/UpdateBanner";
import InstallPrompt from "@/components/InstallPrompt";
import PageTransition from "@/components/PageTransition";
import AppFooter from "@/components/AppFooter";
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "./pages/NotFound.tsx";
import { usePunchReminder } from "@/hooks/usePunchReminder";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

const DailyPage = lazy(() => import("@/pages/DailyPage"));
const MonthlyPage = lazy(() => import("@/pages/MonthlyPage"));
const BankPage = lazy(() => import("@/pages/BankPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

const queryClient = new QueryClient();
const MIN_PUNCHES = 6;

function OnboardingGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || checked) return;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('default_punches')
        .eq('user_id', user.id)
        .maybeSingle();
      const punches = (data?.default_punches as string[] | undefined) ?? [];
      if (punches.length < MIN_PUNCHES && location.pathname !== '/config') {
        navigate('/config?onboarding=1', { replace: true });
      }
      setChecked(true);
    })();
  }, [user, checked, navigate, location.pathname]);

  return null;
}

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  useSwipeNavigation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
        <Route path="/diario" element={<PageTransition><Suspense fallback={<PageLoader />}><DailyPage /></Suspense></PageTransition>} />
        <Route path="/mensal" element={<PageTransition><Suspense fallback={<PageLoader />}><MonthlyPage /></Suspense></PageTransition>} />
        <Route path="/banco" element={<PageTransition><Suspense fallback={<PageLoader />}><BankPage /></Suspense></PageTransition>} />
        <Route path="/config" element={<PageTransition><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></PageTransition>} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

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
      <OnboardingGate />
      <ReminderRunner />
      <UpdateBanner />
      <TopNav />
      <AnimatedRoutes />
      <BottomNav />
      <InstallPrompt />
    </>
  );
}

function ReminderRunner() {
  usePunchReminder();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="mx-auto max-w-lg lg:max-w-7xl">
            <AppRoutes />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
