import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, UserCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  drawerId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  isMobileMenuOpen = false,
  drawerId = 'mobile-nav-drawer',
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role?: string, isAdmin?: boolean) => {
    if (role === 'admin' || isAdmin) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    switch (role) {
      case 'doctor':
      case 'dentist':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'student':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'receptionist':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-sm gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            id="mobile-drawer-open"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls={drawerId}
            className="lg:hidden p-2 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 truncate block sm:hidden">
              PGI Dental Branch
            </span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-600 truncate">
              Oral Health Sciences Centre, PGIMER Chandigarh
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {user?.is_admin && user.role !== 'admin' && (
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            Faculty Admin
          </span>
        )}

        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getRoleBadgeColor(
            user?.role,
            user?.is_admin
          )}`}
        >
          {user?.role}
        </span>

        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800 leading-tight max-w-[140px] truncate">
              {user?.full_name}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight max-w-[140px] truncate">
              {user?.email}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <UserCircle className="w-5 h-5 text-slate-500" aria-hidden="true" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
