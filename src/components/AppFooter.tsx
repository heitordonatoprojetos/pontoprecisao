import { APP_VERSION } from '@/lib/version';

/**
 * Rodapé padrão exibido em todas as abas autenticadas e na página de login.
 * Margem inferior maior em mobile para não ficar atrás da BottomNav.
 */
export default function AppFooter() {
  return (
    <footer className="px-4 pb-20 pt-2 text-center lg:pb-4">
      <p className="text-[11px] text-muted-foreground">© 2026 - v.{APP_VERSION}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Developed by devX</p>
    </footer>
  );
}
