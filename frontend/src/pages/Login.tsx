import React, { useId, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stethoscope, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailInputId = useId();
  const passwordInputId = useId();

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = await login(usernameOrEmail, password);
      if (loggedInUser.role === 'patient') {
        navigate('/portal/appointments', { replace: true });
      } else if (loggedInUser.role === 'receptionist') {
        navigate('/attendance', { replace: true });
      } else {
        const target =
          from === '/login' || from.startsWith('/portal') || from === '/attendance'
            ? '/dashboard'
            : from;
        navigate(target, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (email: string) => {
    setUsernameOrEmail(email);
    setPassword('Dental@123');
    setError(null);
  };

  const demoPersonas = [
    { role: 'Admin', label: 'Faculty Admin', email: 'admin@pgi.edu.in', cardClass: 'bg-purple-950/50 hover:bg-purple-900/60 border-purple-700/50 text-purple-300' },
    { role: 'Doctor', label: 'Dr. Mehta', email: 'dr.mehta@pgi.edu.in', cardClass: 'bg-teal-950/50 hover:bg-teal-900/60 border-teal-700/50 text-teal-300' },
    { role: 'Student', label: 'PG Trainee', email: 'student1@pgi.edu.in', cardClass: 'bg-indigo-950/50 hover:bg-indigo-900/60 border-indigo-700/50 text-indigo-300' },
    { role: 'Reception', label: 'Attendance', email: 'reception@pgi.edu.in', cardClass: 'bg-blue-950/50 hover:bg-blue-900/60 border-blue-700/50 text-blue-300' },
    { role: 'Patient', label: 'Portal User', email: 'patient@pgi.edu.in', cardClass: 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-700/50 text-emerald-300' },
  ];

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-slate-100">
      {/* Left Feature Showcase */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden border-r border-slate-700/50">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-teal-600/10 blur-3xl pointer-events-none" />

        {/* Branding */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-teal-500/30">
            <Stethoscope className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">PGI Dental Branch</h1>
            <p className="text-xs text-teal-400 font-semibold tracking-wider uppercase">
              Oral Health Sciences Centre, PGIMER Chandigarh
            </p>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="space-y-6 z-10 my-auto py-12 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>PGIMER Clinical Dental EMR Platform</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Unified clinical dentistry workflows from intake to long-term recall.
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Interactive FDI restorative & 6-site periodontal charting, operatory-wise smart scheduling, multilingual (EN/HI/PA) prescriptions, encrypted CBCT/OPG imaging vault, and patient care recalls.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="text-2xl font-bold text-white">FDI + Perio</p>
              <p className="text-xs text-slate-300 mt-1">32-tooth restorative & 6-site periodontal charting</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="text-2xl font-bold text-teal-400">5 Roles RBAC</p>
              <p className="text-xs text-slate-300 mt-1">Strict isolation across Admin, Doctors, Students, Reception & Patients</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-2 text-xs text-slate-400 z-10">
          <ShieldCheck className="w-4 h-4 text-teal-400" aria-hidden="true" />
          <span>AES-256 Encrypted Clinical Storage • PGIMER Oral Health Sciences Centre</span>
        </div>
      </div>

      {/* Right Login Form */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md space-y-6 bg-slate-900/85 p-6 sm:p-9 rounded-3xl border border-slate-700/60 shadow-2xl backdrop-blur-xl">
          <div>
            <div className="lg:hidden flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center text-white flex-shrink-0">
                <Stethoscope className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-bold text-white block leading-tight">PGI Dental Branch</span>
                <span className="text-[10px] text-teal-400 font-semibold">
                  Oral Health Sciences Centre, PGIMER Chandigarh
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">Sign In to PGI Portal</h2>
            <p className="text-xs text-slate-300 mt-1">
              Enter your PGI Dental credentials or select any demo persona below.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-950/70 border border-red-700 rounded-xl text-xs text-red-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={emailInputId} className="block text-xs font-semibold text-slate-200 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                <input
                  id={emailInputId}
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="name@pgi.edu.in"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor={passwordInputId} className="block text-xs font-semibold text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                <input
                  id={passwordInputId}
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'Verifying...' : 'Sign In to PGI Workspace'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          {/* 1-Click Demo Profiles */}
          <div className="pt-4 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              1-Click PGI Demo Personas (Password: Dental@123)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {demoPersonas.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleQuickLogin(p.email)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${p.cardClass}`}
                >
                  <span className="block text-[10px] font-bold uppercase">{p.role}</span>
                  <span className="block text-[11px] text-white font-medium truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
