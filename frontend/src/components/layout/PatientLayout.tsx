import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    CalendarDays,
    FileSpreadsheet,
    FolderCheck,
    LogOut,
    Stethoscope,
    ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PatientLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinks = [
        { name: 'My Appointments', to: '/portal/appointments', icon: CalendarDays },
        { name: 'My Prescriptions & Instructions', to: '/portal/prescriptions', icon: FileSpreadsheet },
        { name: 'Tests, Scans & Shared Records', to: '/portal/shared-records', icon: FolderCheck },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-x-hidden">
            {/* Top Navbar */}
            <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
                    {/* Brand */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 flex-shrink-0">
                            <Stethoscope className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm tracking-tight text-white truncate">
                                    PGI Dental Branch
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    Patient Portal
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                                Oral Health Sciences Centre, PGIMER Chandigarh
                            </p>
                        </div>
                    </div>

                    {/* Desktop Nav Links */}
                    <nav aria-label="Patient portal navigation" className="hidden lg:flex items-center gap-1">
                        {navLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${isActive
                                            ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30 font-bold'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                                        }`
                                    }
                                >
                                    <Icon className="w-4 h-4" aria-hidden="true" />
                                    <span>{item.name}</span>
                                </NavLink>
                            );
                        })}
                    </nav>

                    {/* User Status & Logout */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs">
                                {user?.full_name?.charAt(0) || 'P'}
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold text-white truncate max-w-[140px]">
                                    {user?.full_name}
                                </p>
                                <p className="text-[10px] text-teal-400 font-mono">Patient Account</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            aria-label="Sign out"
                            className="p-2 rounded-xl text-slate-300 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                        >
                            <LogOut className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Mobile / Tablet Single-Row Scrollable Sub-Navigation Bar */}
                <nav
                    aria-label="Mobile patient portal navigation"
                    className="lg:hidden border-t border-slate-800 bg-slate-950 px-2 py-1.5 tab-scroll-strip gap-1"
                >
                    {navLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${isActive
                                        ? 'bg-teal-600 text-white font-bold'
                                        : 'text-slate-300 hover:text-white'
                                    }`
                                }
                            >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                <span>{item.name}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true" />
                    <span>
                        Encrypted Patient Health Portal • PGI Dental Branch — Oral Health Sciences Centre, PGIMER Chandigarh
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default PatientLayout;
