import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import HomePage from "@/pages/HomePage";
import DailyPage from "@/pages/DailyPage";
import MonthlyPage from "@/pages/MonthlyPage";
import BankPage from "@/pages/BankPage";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "./pages/NotFound.tsx";

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/diario" element={<DailyPage />} />
        <Route path="/mensal" element={<MonthlyPage />} />
        <Route path="/banco" element={<BankPage />} />
        <Route path="/config" element={<SettingsPage />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
      <InstallPrompt />
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
