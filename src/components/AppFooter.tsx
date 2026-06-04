import { APP_VERSION } from '@/lib/version';

/**
 * Rodapé padrão exibido em todas as abas autenticadas e na página de login.
 */
export default function AppFooter() {
  return (
    <footer className="mt-6 mb-2 px-4 text-center">
      <p className="text-[11px] text-muted-foreground">© 2026 - v.{APP_VERSION}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Developed by devX</p>
    </footer>
  );
}
