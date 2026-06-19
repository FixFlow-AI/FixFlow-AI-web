import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, Users, History, BarChart3, ArrowLeft } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();

  const adminLinks = [
    { name: 'User Management', path: '/admin/users', icon: <Users className="w-4.5 h-4.5" /> },
    { name: 'Ledger Audit Trails', path: '/admin/audit', icon: <History className="w-4.5 h-4.5" /> },
    { name: 'Platform Analytics', path: '/admin/analytics', icon: <BarChart3 className="w-4.5 h-4.5" /> }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex bg-brand-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-purple-950/40 bg-purple-950/5 flex flex-col justify-between p-5 sticky top-0 h-screen">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center space-x-2 px-2 text-purple-400">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-bold font-outfit tracking-tight">
              FixFlow <span className="text-slate-100 font-normal">Governance</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(link.path)
                    ? 'bg-purple-600/10 text-purple-400 font-medium border-l-2 border-purple-500'
                    : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Back Link */}
        <div className="border-t border-slate-900 pt-4">
          <Link
            to="/app/dashboard"
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm text-blue-400 hover:bg-blue-950/10 transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
            <span>App Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow p-6 md:p-8 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};
export default AdminLayout;
