import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Layers, 
  FileEdit, 
  FolderGit2, 
  Lock, 
  User, 
  Settings, 
  ShieldAlert, 
  ChevronDown, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface AppLayoutProps {
  user: {
    email: string;
    role: string;
    mfaEnabled: boolean;
  };
  onLogout: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarLinks = [
    { name: 'Dashboard', path: '/app/dashboard', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
    { name: 'Leads', path: '/app/leads', icon: <Layers className="w-4.5 h-4.5" /> },
    { name: 'Proposals', path: '/app/proposals', icon: <FileEdit className="w-4.5 h-4.5" /> },
    { name: 'Workspaces', path: '/app/workspaces', icon: <FolderGit2 className="w-4.5 h-4.5" /> },
    { name: 'Escrow Payouts', path: '/app/escrow', icon: <Lock className="w-4.5 h-4.5" /> },
    { name: 'Profile Scan', path: '/app/profile', icon: <User className="w-4.5 h-4.5" /> },
    { name: 'Security Settings', path: '/app/settings', icon: <Settings className="w-4.5 h-4.5" /> }
  ];

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex bg-brand-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950/40 flex flex-col justify-between p-5 sticky top-0 h-screen">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center space-x-2 px-2">
            <Lock className="w-5 h-5 text-blue-500" />
            <span className="font-bold font-outfit tracking-tight text-white">
              FixFlow <span className="text-blue-500 font-normal">Dashboard</span>
            </span>
          </div>

          {/* Active Workspace Selector */}
          <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-outfit">Active Workspace</p>
              <p className="text-xs font-semibold text-slate-200">Main Agency Dev</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(link.path)
                    ? 'bg-blue-600/10 text-blue-400 font-medium border-l-2 border-blue-500'
                    : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}

            {user.role === 'SUPER_ADMIN' && (
              <Link
                to="/admin/users"
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm text-purple-400 hover:bg-purple-950/10 transition-colors"
              >
                <ShieldCheck className="w-4.5 h-4.5 text-purple-400" />
                <span>Admin Governance</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="border-t border-slate-900 pt-4 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-800 flex items-center justify-center text-xs font-bold text-blue-400 font-outfit">
              {user.email.substring(0, 2).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-300 truncate">{user.email}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/10 transition-colors focus:outline-none"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Security Warning Notification Banner */}
        {!user.mfaEnabled && (
          <div className="bg-amber-950/30 border-b border-amber-900/35 px-6 py-2.5 flex items-center space-x-2 text-xs text-amber-400 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>MFA protection is inactive. Set up TOTP verification in Security Settings to release escrow payouts securely.</span>
          </div>
        )}

        <div className="p-6 md:p-8 flex-grow">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
export default AppLayout;
