import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Activity,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  RefreshCw,
  GraduationCap,
  Stethoscope,
  UserCheck,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DashboardSummary, DashboardAnalytics } from '../types';
import { dashboardApi } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  confirmed: '#06b6d4',
  in_progress: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
  no_show: '#94a3b8',
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);

  // Role-specific dashboard data
  const [adminData, setAdminData] = useState<any | null>(null);
  const [doctorData, setDoctorData] = useState<any | null>(null);
  const [studentData, setStudentData] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const role = user?.role;
  const isDoctor = role === 'doctor' || role === 'dentist';
  const isAdmin = role === 'admin';
  const isStudent = role === 'student';

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const promises: Promise<any>[] = [
        dashboardApi.getSummary(period),
        dashboardApi.getAnalytics(period === 'today' ? 7 : period === '7d' ? 14 : 30),
      ];

      if (isAdmin) {
        promises.push(dashboardApi.getAdminDashboard().catch(() => null));
      } else if (isDoctor) {
        promises.push(dashboardApi.getDoctorDashboard().catch(() => null));
      } else if (isStudent) {
        promises.push(dashboardApi.getStudentDashboard().catch(() => null));
      }

      const [sumRes, anaRes, roleRes] = await Promise.all(promises);
      setSummary(sumRes);
      setAnalytics(anaRes);

      if (isAdmin && roleRes) setAdminData(roleRes);
      else if (isDoctor && roleRes) setDoctorData(roleRes);
      else if (isStudent && roleRes) setStudentData(roleRes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period, role]);

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isAdmin && 'System Administration & Clinic Dashboard'}
            {isDoctor && `Doctor Portal – Welcome, ${user?.full_name || 'Doctor'}`}
            {isStudent && `Student Clinical Workspace – Welcome, ${user?.full_name || 'Student'}`}
            {!isAdmin && !isDoctor && !isStudent && 'Clinic Performance Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin && 'Hierarchical monitoring of doctors, students, patients, and overall clinic activities.'}
            {isDoctor && 'Manage your registered students, supervise patient treatments, and review clinical X-rays.'}
            {isStudent && 'View your assigned patient records, upload diagnostic X-rays, and track clinical observations.'}
            {!isAdmin && !isDoctor && !isStudent && 'Real-time database aggregated clinical indicators, appointments, and patient intake.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Toggle */}
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                  period === p ? 'bg-white text-teal-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboardData}
            title="Refresh statistics"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ADMIN DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {isAdmin && adminData && (
        <div className="space-y-6">
          {/* Admin KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Doctors</span>
                <Stethoscope className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_doctors}</div>
              <Link to="/doctors" className="text-[10px] text-teal-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Manage all doctors <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Students</span>
                <GraduationCap className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_students}</div>
              <Link to="/students" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View student roster <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Patients</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_patients}</div>
              <Link to="/patients" className="text-[10px] text-purple-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View all patient records <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Audit Security</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">Protected</div>
              <Link to="/audit-logs" className="text-[10px] text-emerald-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View activity logs <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Doctor-wise & Student-wise Distribution Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Doctor-wise Patients */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Doctor-wise Patient Distribution</h3>
                  <p className="text-xs text-slate-400">Total patients and registered students under each doctor</p>
                </div>
                <Link to="/doctors" className="text-xs text-teal-600 font-semibold hover:underline">
                  View Doctors
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Doctor</th>
                      <th className="py-2 px-3">Specialization</th>
                      <th className="py-2 px-3 text-center">Students</th>
                      <th className="py-2 px-3 text-right">Patients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminData.doctor_patient_counts?.map((d: any) => (
                      <tr key={d.doctor_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{d.doctor_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{d.specialization || 'General Dentistry'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                            {d.students_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{d.patient_count}</td>
                      </tr>
                    ))}
                    {(!adminData.doctor_patient_counts || adminData.doctor_patient_counts.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">No doctors registered yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student-wise Patients */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Student-wise Patient Distribution</h3>
                  <p className="text-xs text-slate-400">Supervising doctor and assigned patient case load</p>
                </div>
                <Link to="/students" className="text-xs text-blue-600 font-semibold hover:underline">
                  View Students
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Supervising Doctor</th>
                      <th className="py-2 px-3 text-right">Assigned Patients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminData.student_patient_counts?.map((s: any) => (
                      <tr key={s.student_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{s.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.doctor_name || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">{s.patient_count}</td>
                      </tr>
                    ))}
                    {(!adminData.student_patient_counts || adminData.student_patient_counts.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">No students registered yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DOCTOR DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {isDoctor && doctorData && (
        <div className="space-y-6">
          {/* Doctor KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">My Students</span>
                <GraduationCap className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{doctorData.total_students}</div>
              <Link to="/students" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Manage registered students <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Patients</span>
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{doctorData.total_patients}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                {doctorData.patients_registered_directly} direct, {doctorData.patients_assigned_to_students} assigned
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Assigned to Students</span>
                <UserCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{doctorData.patients_assigned_to_students}</div>
              <div className="text-[10px] text-purple-700 font-semibold mt-1">Under clinical supervision</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Follow-ups</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{doctorData.pending_followups}</div>
              <Link to="/followups" className="text-[10px] text-amber-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Review clinical alerts <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Doctor Student Roster & Recent Patients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Roster */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Students Under My Supervision</h3>
                  <p className="text-xs text-slate-400">Manage assignments and review patient caseloads</p>
                </div>
                <Link to="/students" className="text-xs text-teal-600 font-semibold hover:underline">
                  + Add Student
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Enrollment / College</th>
                      <th className="py-2 px-3 text-right">Assigned Cases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctorData.students?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{s.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {s.enrollment_number || 'No Enroll #'} • {s.college_institution || 'Institution'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">{s.patient_count}</td>
                      </tr>
                    ))}
                    {(!doctorData.students || doctorData.students.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">No students registered yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Patients */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Recent Patient Registrations</h3>
                  <p className="text-xs text-slate-400">Directly registered or student-handled patients</p>
                </div>
                <Link to="/patients" className="text-xs text-teal-600 font-semibold hover:underline">
                  All Patients
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">CR Number</th>
                      <th className="py-2 px-3">Patient Name</th>
                      <th className="py-2 px-3">Assigned Student</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctorData.recent_patients?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{p.cr_number || `PAT-${p.id}`}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{p.patient_name}</td>
                        <td className="py-2.5 px-3">
                          {p.student_name ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                              {p.student_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Direct (Unassigned)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link to={`/patients/${p.id}`} className="text-teal-600 font-semibold hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {(!doctorData.recent_patients || doctorData.recent_patients.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">No patients registered yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STUDENT DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {isStudent && studentData && (
        <div className="space-y-6">
          {/* Student KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">My Assigned Patients</span>
                <Users className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.my_patients_count}</div>
              <Link to="/patients" className="text-[10px] text-teal-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View my assigned cases <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Records</span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.pending_records}</div>
              <div className="text-[10px] text-amber-700 font-semibold mt-1">Clinical charting / X-rays needed</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming Appointments</span>
                <CalendarCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.upcoming_appointments}</div>
              <Link to="/appointments" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View calendar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Student Assigned Patients List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">My Assigned Clinical Cases</h3>
                <p className="text-xs text-slate-400">Patients under your clinical care and supervision</p>
              </div>
              <Link to="/patients" className="text-xs text-teal-600 font-semibold hover:underline">
                Register New Patient
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">CR Number</th>
                    <th className="py-2 px-3">Patient Name</th>
                    <th className="py-2 px-3">Supervising Doctor</th>
                    <th className="py-2 px-3">Disease Categories</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentData.recent_patients?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{p.cr_number || `PAT-${p.id}`}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{p.patient_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.doctor_name || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {p.disease_categories?.slice(0, 2).map((cat: string) => (
                            <span key={cat} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              {cat}
                            </span>
                          ))}
                          {p.disease_categories?.length > 2 && (
                            <span className="text-[10px] text-slate-400">+{p.disease_categories.length - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link to={`/patients/${p.id}`} className="text-teal-600 font-semibold hover:underline">
                          Open File
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!studentData.recent_patients || studentData.recent_patients.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">No patients assigned yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GENERAL CLINICAL PERFORMANCE CARDS & CHARTS (FOR RECEPTION / FALLBACK / OVERVIEW) */}
      {/* ========================================================================= */}
      {(!isAdmin && !isDoctor && !isStudent) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Patients</span>
              <Users className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.total_patients ?? 0}
            </div>
            <div className="text-[10px] text-teal-700 font-semibold mt-1">
              +{summary?.new_patients_period ?? 0} new in period
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Appts</span>
              <CalendarCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.today_appointments ?? 0}
            </div>
            <div className="text-[10px] text-blue-700 font-semibold mt-1">
              {summary?.upcoming_appointments ?? 0} upcoming days
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Tx</span>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.pending_treatments ?? 0}
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-1">
              {summary?.completed_treatments ?? 0} completed
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Follow-ups Due</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.followups_due ?? 0}
            </div>
            <div className="text-[10px] text-purple-700 font-semibold mt-1">
              Requires clinical review
            </div>
          </div>
        </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointment Status Distribution (Pie / Bar) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Appointments by Operational Status</h3>
              <p className="text-xs text-slate-400">Distribution across scheduled, confirmed, completed, cancelled</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {analytics?.appointments_by_status && analytics.appointments_by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.appointments_by_status} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" name="Appointments" radius={[6, 6, 0, 0]}>
                    {analytics.appointments_by_status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#14b8a6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading charts...</div>
            )}
          </div>
        </div>

        {/* Treatments by Procedure Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Treatments by Procedure Type</h3>
              <p className="text-xs text-slate-400">Frequency of restorative, endodontic, and preventive procedures</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {analytics?.treatments_by_procedure && analytics.treatments_by_procedure.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={analytics.treatments_by_procedure} margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="procedure_name" tick={{ fontSize: 9, fill: '#64748b' }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" name="Procedures Performed" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No procedures recorded yet</div>
            )}
          </div>
        </div>

        {/* New Patients Registration Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Patient Intake Trend</h3>
              <p className="text-xs text-slate-400">Newly registered patients over time</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {analytics?.patients_trend && analytics.patients_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.patients_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="new_patients" name="New Patients" stroke="#10b981" fill="#ecfdf5" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading charts...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
