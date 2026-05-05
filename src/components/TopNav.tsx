import { NavLink } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { APP_NAME } from '@/lib/version';

const tabs = [
  { to: '/', label: 'Ponto', end: true },
  { to: '/diario', label: 'Diário' },
  { to: '/mensal', label: 'Mensal' },
  { to: '/banco', label: 'Banco' },
  { to: '/config', label: 'Config' },
];

export default function TopNav() {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-card/95 backdrop-blur-lg lg:block">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock className="h-4 w-4" />
            </div>
            {APP_NAME}
          </div>
          <ul className="flex gap-1">
            {tabs.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
