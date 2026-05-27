import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Camera, MapPin, Bell, Users as UsersIcon, Shield, MessageCircle,
  Settings as SettingsIcon, LogOut, Menu, X,
} from 'lucide-react';
import { getSession, logout, canView } from '@/lib/auth';
import { cn } from '@/lib/cn';
import Branches  from '@/pages/admin/Branches.jsx';
import Cameras   from '@/pages/admin/Cameras.jsx';
import Rules     from '@/pages/admin/Rules.jsx';
import Events    from '@/pages/admin/Events.jsx';
import Users     from '@/pages/admin/Users.jsx';
import Settings  from '@/pages/admin/Settings.jsx';
import Dashboard from '@/pages/admin/Dashboard.jsx';
import AlertRecipients from '@/pages/admin/AlertRecipients.jsx';

const NAV = [
  { to: '',           label: 'Dashboard',  icon: LayoutDashboard, perm: 'dashboard' },
  { to: 'branches',   label: 'Branches',   icon: MapPin,          perm: 'branches' },
  { to: 'cameras',    label: 'Cameras',    icon: Camera,          perm: 'cameras' },
  { to: 'rules',      label: 'Rules',      icon: Shield,          perm: 'rules' },
  { to: 'events',     label: 'Events',     icon: Bell,            perm: 'events' },
  { to: 'recipients', label: 'Recipients', icon: MessageCircle,   perm: 'alert_recipients' },
  { to: 'users',      label: 'Users',      icon: UsersIcon,       perm: 'users' },
  { to: 'settings',   label: 'Settings',   icon: SettingsIcon,    perm: 'settings' },
];

function Placeholder({ title }) {
  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-500">Coming online in the next build pass.</p>
    </div>
  );
}

export default function AppShell() {
  const session = getSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setOpen(false); }, [navigate]);

  if (!session) return null;

  // Admin sees everything regardless of role_permissions rows for missing screen_keys.
  const visibleNav = NAV.filter((n) => session.roleName === 'Admin' || canView(n.perm));

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full bg-ink-50 text-ink-900">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="flex h-16 items-center px-5 text-lg font-bold tracking-tight">
          <span className="text-ink-900">Smart</span>
          <span className="text-burgundy-600">Snap</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === ''}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-burgundy-50 text-burgundy-700' : 'text-ink-700 hover:bg-ink-100'
                )
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-200 p-4">
          <div className="text-xs text-ink-500">Signed in as</div>
          <div className="text-sm font-semibold">{session.name}</div>
          <div className="text-xs text-ink-500">{session.roleName}</div>
          <button onClick={onLogout} className="btn-ghost mt-3 w-full"><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-4 md:hidden">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-ink-900">Smart</span>
            <span className="text-burgundy-600">Snap</span>
          </div>
          <button onClick={() => setOpen(true)} className="p-2 text-ink-700"><Menu size={22} /></button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between px-4">
                <div className="text-lg font-bold tracking-tight">
                  <span className="text-ink-900">Smart</span>
                  <span className="text-burgundy-600">Snap</span>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 text-ink-700"><X size={22} /></button>
              </div>
              <nav className="space-y-1 px-3 py-2">
                {visibleNav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === ''}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                        isActive ? 'bg-burgundy-50 text-burgundy-700' : 'text-ink-700 hover:bg-ink-100'
                      )
                    }
                  >
                    <n.icon size={18} /> {n.label}
                  </NavLink>
                ))}
                <button onClick={onLogout} className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
                  <LogOut size={18} /> Logout
                </button>
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index             element={<Dashboard />} />
            <Route path="branches"   element={<Branches />} />
            <Route path="cameras"    element={<Cameras />} />
            <Route path="rules"      element={<Rules />} />
            <Route path="events"     element={<Events />} />
            <Route path="recipients" element={<AlertRecipients />} />
            <Route path="users"      element={<Users />} />
            <Route path="settings"   element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
