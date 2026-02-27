import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Music2, Library, BarChart2, LogOut, Building2, Globe, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth';

const venueAdminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/dj', icon: Music2, label: 'DJ Mode' },
  { to: '/admin/library', icon: Library, label: 'Library' },
  { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const superAdminNav = [
  { to: '/admin/venues', icon: Building2, label: 'Venues' },
  { to: '/admin/global-library', icon: Globe, label: 'Global Library' },
];

export default function AdminLayout() {
  const location = useLocation();
  const admin = authService.getStoredAdmin();
  const isSuperAdmin = admin?.role === 'super_admin';
  const navItems = isSuperAdmin ? superAdminNav : venueAdminNav;

  if (!authService.isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-brand-600" />
          <span className="font-display font-semibold text-stone-900">Jukebox</span>
          <span className="text-stone-500 text-sm">{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
        </div>
        <button
          type="button"
          onClick={() => { authService.logout(); window.location.href = '/admin/login'; }}
          className="text-stone-500 hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-2 flex justify-around z-40">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${active ? 'text-brand-600' : 'text-stone-500 hover:text-stone-900'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
