import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Activity,
  FileSpreadsheet,
  Receipt,
  Clock,
  BarChart3,
  ShieldCheck,
  UserCog,
  Stethoscope,
  FolderOpen,
  Scan,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'dentist', 'doctor', 'student', 'receptionist'] },
  { name: 'Doctors', to: '/doctors', icon: Stethoscope, roles: ['admin'] },
  { name: 'Students', to: '/students', icon: GraduationCap, roles: ['admin', 'dentist', 'doctor'] },
  { name: 'Patients', to: '/patients', icon: Users, roles: ['admin', 'dentist', 'doctor', 'student', 'receptionist'] },
  { name: 'Appointments', to: '/appointments', icon: CalendarDays, roles: ['admin', 'dentist', 'doctor', 'student', 'receptionist'] },
  { name: 'Treatments', to: '/treatments', icon: Activity, roles: ['admin', 'dentist', 'doctor'] },
  { name: 'Prescriptions', to: '/prescriptions', icon: FileSpreadsheet, roles: ['admin', 'dentist', 'doctor'] },
  { name: 'X-rays & 3D', to: '/xrays', icon: Scan, roles: ['admin', 'dentist', 'doctor', 'student'] },
  { name: 'Follow-ups', to: '/followups', icon: Clock, roles: ['admin', 'dentist', 'doctor', 'receptionist'] },
  { name: 'Documents', to: '/documents', icon: FolderOpen, roles: ['admin', 'dentist', 'doctor', 'student', 'receptionist'] },
  { name: 'Audit Logs', to: '/audit-logs', icon: ShieldCheck, roles: ['admin'] },
  { name: 'Staff Accounts', to: '/users', icon: UserCog, roles: ['admin'] },
];

export const Sidebar: React.FC = () => {
  const { user, hasRole } = useAuth();

  const filteredNavItems = navItems.filter((item) =>
    user ? hasRole(...item.roles) : false
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* Clinic Branding */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            Apex Dental Care
          </h1>
          <p className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">
            Clinical Management
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </div>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-600 text-white font-semibold shadow-md shadow-teal-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>

      {/* User Status Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/60">
          <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs uppercase">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
            <span className="inline-block text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
