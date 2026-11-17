import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { useInbox } from '../api/hooks';
import { canDecide, useAuth } from '../auth/AuthContext';
import { fmtDate, todayISO } from '../lib/dates';
import { Icon, type IconName } from './Icon';
import type { ShellContext } from './Topbar';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles: Role[];
  end?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Statement', icon: 'book', roles: ['employee', 'manager'], end: true },
  { to: '/new', label: 'New request', icon: 'plus', roles: ['employee', 'manager'] },
  { to: '/approvals', label: 'Approvals', icon: 'inbox', roles: ['manager', 'admin'], badge: true },
  { to: '/calendar', label: 'Team calendar', icon: 'calendar', roles: ['employee', 'manager', 'admin'] },
  { to: '/team', label: 'Team balances', icon: 'users', roles: ['manager', 'admin'] },
  { to: '/admin', label: 'Rules & setup', icon: 'sliders', roles: ['admin'] },
];

const ROLE_LABEL: Record<Role, string> = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

export function Layout() {
  const { user, logout } = useAuth();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();

  // On a phone the nav is a scrolling strip; keep the page you are on in view.
  useEffect(() => {
    document.querySelector<HTMLElement>(".nav-link.is-active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname, slot]);
  const pending = useInbox('pending', !!user && canDecide(user.role));
  if (!user) return null;

  const items = NAV.filter((item) => item.roles.includes(user.role));
  const pendingCount = pending.data?.length ?? 0;

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="3" y="2" width="20" height="22" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 2v22" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 9h7M12 13h7M12 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Passbook</span>
        </div>

        <nav aria-label="Main">
          <ul className="nav">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge && pendingCount > 0 ? (
                    <span className="nav-badge num" aria-label={`${pendingCount} pending`}>
                      {pendingCount}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rail-user">
          <div className="rail-user-name">{user.name}</div>
          <div className="rail-user-role">{ROLE_LABEL[user.role]}</div>
          <button type="button" className="rail-signout" onClick={logout}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="stage">
        <header className="topbar">
          <p className="topbar-today">
            <span className="topbar-label">Today</span> <span className="num">{fmtDate(todayISO(), true)}</span>
          </p>
          <div className="topbar-slot" ref={setSlot} />
        </header>
        <main className="main" id="main">
          <Outlet context={{ slot } satisfies ShellContext} />
        </main>
      </div>
    </div>
  );
}
