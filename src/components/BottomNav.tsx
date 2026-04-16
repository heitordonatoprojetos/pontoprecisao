import { NavLink } from 'react-router-dom';
import { Clock, CalendarDays, BarChart3, Wallet, Settings } from 'lucide-react';

const tabs = [
  { to: '/', icon: Clock, label: 'Ponto' },
  { to: '/diario', icon: CalendarDays, label: 'Diário' },
  { to: '/mensal', icon: BarChart3, label: 'Mensal' },
  { to: '/banco', icon: Wallet, label: 'Banco' },
  { to: '/config', icon: Settings, label: 'Config' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1.5">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
