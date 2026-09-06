// src/components/TabBar.tsx — replaces the router/placeholders.tsx dumb
// version. Floating glass capsule, ported from index.html's #tab-bar CSS +
// icons; ADR-024's 44×44px real touch targets, not the vanilla app's
// original 19×19px icons. Shown only on these four routes — an allow-list,
// same as the vanilla app's own SCREENS_WITH_TAB_BAR — so it's hidden on
// /log and on any other route (e.g. /settings/pin-setup) without needing a
// growing blacklist.
import { BarChart3, Calendar, Home, Settings as SettingsIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from 'cn';

const TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/calendar', label: 'Calendar', Icon: Calendar, end: false },
  { to: '/insights', label: 'Insights', Icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
] as const;

const SCREENS_WITH_TAB_BAR = new Set(TABS.map((t) => t.to));

export function TabBar() {
  const location = useLocation();
  if (!SCREENS_WITH_TAB_BAR.has(location.pathname as (typeof TABS)[number]['to'])) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom,0.5rem)] z-10 mx-auto flex w-[min(26rem,calc(100%-2*var(--spacing-flow-4)))] justify-around rounded-flow-tabbar border-[0.5px] border-glass-border bg-glass-fill px-flow-4 py-flow-2 backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            cn(
              'inline-flex size-11 items-center justify-center rounded-full transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground',
            )
          }
        >
          <Icon aria-hidden="true" className="size-5" />
        </NavLink>
      ))}
    </nav>
  );
}
