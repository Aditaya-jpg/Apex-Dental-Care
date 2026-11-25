import React, { useState, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Activity,
  Clock,
  AlertTriangle,
  CalendarCheck,
  RefreshCw,
  GraduationCap,
  Stethoscope,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  FileText,
  UserMinus,
  Plus,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { DashboardSummary, DashboardAnalytics, Patient, SeverityLevel, Appointment } from '../types';
import { dashboardApi } from '../api/dashboard';
import { appointmentsApi } from '../api/appointments';
import { patientsApi } from '../api/patients';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import { SEVERITY_META, getPainColorClass, formatDateIN } from '../utils/formatters';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  confirmed: '#06b6d4',
  checked_in: '#0ea5e9',
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

  const [adminData, setAdminData] = useState<any | null>(null);
  const [doctorData, setDoctorData] = useState<any | null>(null);
  const [studentData, setStudentData] = useState<any | null>(null);

  // Doctor interactive widgets state
  const [missedAppointments, setMissedAppointments] = useState<Appointment[]>([]);
  const [triagePatients, setTriagePatients] = useState<Patient[]>([]);
  const [triageEdits, setTriageEdits] = useState<
    Record<number, { pain_scale: number; severity_level: SeverityLevel }>
  >({});
  const [savingTriageId, setSavingTriageId] = useState<number | null>(null);
  const [triageMessage, setTriageMessage] = useState<string | null>(null);

  // Missed Patient Modal
  const [isMissedModalOpen, setIsMissedModalOpen] = useState(false);
  const [missedPatientId, setMissedPatientId] = useState<string>('');
  const [missedCrNumber, setMissedCrNumber] = useState('');
  const [missedDate, setMissedDate] = useState(new Date().toISOString().slice(0, 10));
  const [missedReason, setMissedReason] = useState('Patient did not report for scheduled slot');
  const [missedNotes, setMissedNotes] = useState('');
  const [sendRecallAlert, setSendRecallAlert] = useState(true);
  const [isSubmittingMissed, setIsSubmittingMissed] = useState(false);
  const [missedError, setMissedError] = useState<string | null>(null);
  const [branchPatients, setBranchPatients] = useState<Patient[]>([]);

  const missedPatSelectId = useId();
  const missedCrInputId = useId();
  const missedDateInputId = useId();
  const missedReasonInputId = useId();
  const missedNotesInputId = useId();
  const missedRecallId = useId();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const role = user?.role;
  const isAdmin = role === 'admin' || user?.is_admin === true;
  const isDoctor = !isAdmin && (role === 'doctor' || role === 'dentist');
  const isDoctorView = role === 'doctor' || role === 'dentist';
  const isStudent = role === 'student';

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const promises: Promise<any>[] = [
        dashboardApi.getSummary(period),
        dashboardApi.getAnalytics(period === 'today' ? 7 : period === '7d' ? 14 : 30),
      ];

      if (role === 'admin') {
        promises.push(dashboardApi.getAdminDashboard().catch(() => null));
      } else if (isDoctorView) {
        promises.push(dashboardApi.getDoctorDashboard().catch(() => null));
      } else if (isStudent) {
        promises.push(dashboardApi.getStudentDashboard().catch(() => null));
      }

      const [sumRes, anaRes, roleRes] = await Promise.all(promises);
      setSummary(sumRes);
      setAnalytics(anaRes);

      if (role === 'admin' && roleRes) {
        setAdminData(roleRes);
      } else if (isDoctorView) {
        if (roleRes) setDoctorData(roleRes);

        const [missedRes, patListRes] = await Promise.all([
          roleRes?.missed_appointments
            ? Promise.resolve(roleRes.missed_appointments)
            : appointmentsApi.list({ status: 'no_show' }).catch(() => []),
          patientsApi.list({ page: 1, pageSize: 50, scope: 'all' }).catch(() => ({ items: [] })),
        ]);

        setMissedAppointments(missedRes || []);
        const allPats: Patient[] = patListRes?.items || [];
        setBranchPatients(allPats);

        const highSeveritySource: Patient[] =
          roleRes?.high_severity_patients ||
          allPats
            .filter(
              (p) =>
                (p.pain_scale ?? 0) >= 4 ||
                ['moderate', 'severe', 'critical'].includes(p.severity_level || 'none')
            )
            .slice(0, 8);

        const triageList =
          highSeveritySource.length > 0 ? highSeveritySource : allPats.slice(0, 5);
        setTriagePatients(triageList);

        const initialEdits: Record<number, { pain_scale: number; severity_level: SeverityLevel }> = {};
        triageList.forEach((p) => {
          initialEdits[p.id] = {
            pain_scale: p.pain_scale ?? 0,
            severity_level: (p.severity_level as SeverityLevel) || 'none',
          };
        });
        setTriageEdits(initialEdits);
      } else if (isStudent && roleRes) {
        setStudentData(roleRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period, role]);

  const handleSaveTriage = async (patientId: number) => {
    const edit = triageEdits[patientId];
    if (!edit) return;
    setSavingTriageId(patientId);
    setTriageMessage(null);
    try {
      await patientsApi.updateSeverity(patientId, {
        pain_scale: edit.pain_scale,
        severity_level: edit.severity_level,
      });
      setTriagePatients((prev) =>
        prev.map((p) =>
          p.id === patientId
            ? { ...p, pain_scale: edit.pain_scale, severity_level: edit.severity_level }
            : p
        )
      );
      setTriageMessage('Pain scale & severity triage saved.');
      setTimeout(() => setTriageMessage(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to update severity triage');
    } finally {
      setSavingTriageId(null);
    }
  };

  const handleSubmitMissedPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missedPatientId && !missedCrNumber.trim()) {
      setMissedError('Please select a patient or enter a CR Number.');
      return;
    }
    setIsSubmittingMissed(true);
    setMissedError(null);
    try {
      await appointmentsApi.logMissed({
        patient_id: missedPatientId ? Number(missedPatientId) : undefined,
        cr_number: missedCrNumber.trim() || undefined,
        missed_date: missedDate,
        reason: missedReason,
        send_recall: sendRecallAlert,
        notes: missedNotes || undefined,
      });
      setIsMissedModalOpen(false);
      setMissedPatientId('');
      setMissedCrNumber('');
      setMissedNotes('');
      await loadDashboardData();
    } catch (err: any) {
      setMissedError(err.message || 'Could not log missed appointment');
    } finally {
      setIsSubmittingMissed(false);
    }
  };

  const doctorDistRows =
    adminData?.doctor_patient_counts || adminData?.doctor_wise_patients || [];
  const studentDistRows =
    adminData?.student_patient_counts || adminData?.student_wise_patients || [];

  const pendingFollowupsCount =
    typeof doctorData?.pending_followups === 'number'
      ? doctorData.pending_followups
      : Array.isArray(doctorData?.pending_followups)
      ? doctorData.pending_followups.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {role === 'admin' && 'PGI Dental Administration & Branch Dashboard'}
            {isDoctorView && `Doctor Clinical Workspace — ${user?.full_name || 'Doctor'}`}
            {isStudent && `PG Trainee Clinical Workspace — ${user?.full_name || 'Student'}`}
            {role !== 'admin' && !isDoctorView && !isStudent && 'PGI Dental Performance Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {role === 'admin' &&
              'Branch-wide supervision across faculty doctors, trainee pool, patients, and compliance.'}
            {isDoctorView &&
              'Unrestricted visibility across all PGI Dental patients, trainee supervision, missed recalls & pain triage.'}
            {isStudent &&
              'Strictly isolated view of your assigned clinical cases, dental charts, and upcoming sessions.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === p
                    ? 'bg-white text-teal-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadDashboardData}
            aria-label="Refresh statistics"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200 bg-white"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. ADMIN DASHBOARD VIEW */}
      {/* ===================================================================== */}
      {role === 'admin' && adminData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Doctors</span>
                <Stethoscope className="w-4 h-4 text-teal-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_doctors ?? 0}</div>
              <Link to="/doctors" className="text-[10px] text-teal-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Manage all doctors <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Students</span>
                <GraduationCap className="w-4 h-4 text-blue-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_students ?? 0}</div>
              <Link to="/students" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Manage unified pool <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Branch Patients</span>
                <Users className="w-4 h-4 text-purple-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{adminData.total_patients ?? 0}</div>
              <Link to="/patients" className="text-[10px] text-purple-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Open patient directory <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Audit & Vault Security</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">AES-256</div>
              <Link to="/audit-logs" className="text-[10px] text-emerald-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View compliance logs <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Doctor-wise Distribution</h2>
                  <p className="text-xs text-slate-400">Operatory cabin, faculty admin status & patient load</p>
                </div>
                <Link to="/doctors" className="text-xs text-teal-600 font-semibold hover:underline">
                  View Doctors
                </Link>
              </div>

              <div tabIndex={0} role="region" aria-label="Doctor distribution table" className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-2 px-3">Doctor</th>
                      <th scope="col" className="py-2 px-3">Operatory</th>
                      <th scope="col" className="py-2 px-3 text-center">Students</th>
                      <th scope="col" className="py-2 px-3 text-right">Patients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctorDistRows.map((d: any) => (
                      <tr key={d.doctor_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{d.doctor_name}</span>
                            {d.is_admin && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {d.specialization || 'General Dentistry'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{d.cabin_operatory || 'Operatory 1'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                            {d.students_count ?? d.student_count ?? 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {d.patient_count ?? 0}
                        </td>
                      </tr>
                    ))}
                    {doctorDistRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No doctors registered yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Student-wise Patient Distribution</h2>
                  <p className="text-xs text-slate-400">Unified branch trainee pool & assigned caseloads</p>
                </div>
                <Link to="/students" className="text-xs text-blue-600 font-semibold hover:underline">
                  View Students
                </Link>
              </div>

              <div tabIndex={0} role="region" aria-label="Student distribution table" className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-2 px-3">Student</th>
                      <th scope="col" className="py-2 px-3">Mentor</th>
                      <th scope="col" className="py-2 px-3 text-right">Assigned Patients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentDistRows.map((s: any) => (
                      <tr key={s.student_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{s.student_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{s.doctor_name || 'Branch Pool'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                          {s.patient_count ?? 0}
                        </td>
                      </tr>
                    ))}
                    {studentDistRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          No students registered yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. DOCTOR DASHBOARD VIEW */}
      {/* ===================================================================== */}
      {isDoctorView && doctorData && (
        <div className="space-y-6">
          {/* Doctor KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Branch Students</span>
                <GraduationCap className="w-4 h-4 text-blue-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {doctorData.total_students ?? doctorData.my_students_count ?? 0}
              </div>
              <Link to="/students" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Manage students pool <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">All Branch Patients</span>
                <Users className="w-4 h-4 text-teal-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {doctorData.total_patients ?? doctorData.all_patients_count ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {doctorData.my_direct_patients ?? doctorData.direct_patients_count ?? 0} my direct •{' '}
                {doctorData.unassigned_patients ?? 0} unassigned
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Student Cases</span>
                <UserCheck className="w-4 h-4 text-purple-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {doctorData.patients_assigned_to_students ?? doctorData.assigned_patients_count ?? 0}
              </div>
              <div className="text-[10px] text-purple-700 font-semibold mt-1">
                Assigned across trainee pool
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Follow-ups</span>
                <Clock className="w-4 h-4 text-amber-500" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{pendingFollowupsCount}</div>
              <Link to="/followups" className="text-[10px] text-amber-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                Review recalls & alerts <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Interactive Doctor Action Widgets: Missed Patients & Pain/Severity Triage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Widget 1: Missed Appointments & Add Missed Patient */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <UserMinus className="w-4 h-4 text-rose-600" aria-hidden="true" />
                    <span>Missed Appointments & Drop-Off Log</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Log missed appointments directly to flag slipping status and send recall notifications.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMissedModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Missed Patient</span>
                </button>
              </div>

              {missedAppointments.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                  No missed appointments logged recently.
                </div>
              ) : (
                <div tabIndex={0} role="region" aria-label="Missed appointments table" className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th scope="col" className="py-2 px-3">Date</th>
                        <th scope="col" className="py-2 px-3">Patient</th>
                        <th scope="col" className="py-2 px-3">Reason</th>
                        <th scope="col" className="py-2 px-3 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {missedAppointments.slice(0, 6).map((m) => (
                        <tr key={m.id} className="hover:bg-rose-50/30">
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-700">
                            {formatDateIN(m.appointment_date)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {m.patient_name || `Patient #${m.patient_id}`}
                            {m.cr_number && (
                              <span className="block text-[10px] font-mono text-slate-500">
                                {m.cr_number}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 max-w-[180px] truncate">
                            {m.missed_reason || m.reason || 'No-show'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Link
                              to={`/patients/${m.patient_id}`}
                              className="text-teal-700 font-semibold hover:underline"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Widget 2: Pain / Severity Triage */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-600" aria-hidden="true" />
                    <span>Pain & Severity Triage</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Adjust 0–10 clinical pain score and triage severity directly from the Doctor Desk.
                  </p>
                </div>
                {triageMessage && (
                  <span role="status" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    {triageMessage}
                  </span>
                )}
              </div>

              {triagePatients.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                  No patients currently queued for pain/severity triage.
                </div>
              ) : (
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {triagePatients.map((p) => {
                    const edit = triageEdits[p.id] || {
                      pain_scale: p.pain_scale ?? 0,
                      severity_level: (p.severity_level as SeverityLevel) || 'none',
                    };
                    const sliderId = `dash-pain-${p.id}`;
                    const sevId = `dash-sev-${p.id}`;
                    const displayName = p.full_name || p.patient_name || `${p.first_name} ${p.last_name}`;

                    return (
                      <div
                        key={p.id}
                        className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <Link
                              to={`/patients/${p.id}`}
                              className="text-xs font-bold text-slate-900 hover:text-teal-700 hover:underline"
                            >
                              {displayName}
                            </Link>
                            <span className="ml-2 font-mono text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                              {p.cr_number || p.patient_code}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              SEVERITY_META[edit.severity_level]?.badgeClass || SEVERITY_META.none.badgeClass
                            }`}
                          >
                            Pain {edit.pain_scale}/10 • {SEVERITY_META[edit.severity_level]?.label || 'None'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          <div className="sm:col-span-5">
                            <label htmlFor={sliderId} className="block text-[10px] font-semibold text-slate-600 mb-1">
                              Pain Scale: <span className={`px-1.5 py-0.5 rounded border ${getPainColorClass(edit.pain_scale)}`}>{edit.pain_scale}/10</span>
                            </label>
                            <input
                              id={sliderId}
                              type="range"
                              min={0}
                              max={10}
                              step={1}
                              value={edit.pain_scale}
                              style={{ '--progress': `${edit.pain_scale * 10}%` } as React.CSSProperties}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTriageEdits((prev) => ({
                                  ...prev,
                                  [p.id]: { ...edit, pain_scale: val },
                                }));
                              }}
                              className="w-full cursor-pointer"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label htmlFor={sevId} className="block text-[10px] font-semibold text-slate-600 mb-1">
                              Severity Level
                            </label>
                            <select
                              id={sevId}
                              value={edit.severity_level}
                              onChange={(e) => {
                                const sev = e.target.value as SeverityLevel;
                                setTriageEdits((prev) => ({
                                  ...prev,
                                  [p.id]: { ...edit, severity_level: sev },
                                }));
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                            >
                              <option value="none">None / Routine</option>
                              <option value="mild">Mild</option>
                              <option value="moderate">Moderate</option>
                              <option value="severe">Severe</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3 flex justify-end pt-3 sm:pt-4">
                            <button
                              type="button"
                              disabled={savingTriageId === p.id}
                              onClick={() => handleSaveTriage(p.id)}
                              className="w-full sm:w-auto px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                            >
                              {savingTriageId === p.id ? 'Saving...' : 'Update'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Doctor Student Roster & Recent Branch Patients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">PGI Branch Students Roster</h2>
                  <p className="text-xs text-slate-400">Unified trainee pool available for patient supervision</p>
                </div>
                <Link to="/students" className="text-xs text-teal-600 font-semibold hover:underline">
                  Manage Students
                </Link>
              </div>

              <div tabIndex={0} role="region" aria-label="Doctor student roster table" className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-2 px-3">Student Name</th>
                      <th scope="col" className="py-2 px-3">Roll No / Dept</th>
                      <th scope="col" className="py-2 px-3 text-right">Assigned Cases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(doctorData.students || doctorData.my_students || []).map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {s.student_name || s.full_name || s.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {s.roll_number || s.enrollment_number || 'Roll #'} • {s.department || s.college_institution || 'PGI Dental'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                          {s.patient_count ?? s.patients_count ?? 0}
                        </td>
                      </tr>
                    ))}
                    {(!doctorData.students && !doctorData.my_students) ||
                    (doctorData.students || doctorData.my_students || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          No students registered yet
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Recent Branch Patients</h2>
                  <p className="text-xs text-slate-400">All PGI branch registrations across doctors & trainees</p>
                </div>
                <Link to="/patients" className="text-xs text-teal-600 font-semibold hover:underline">
                  All Patients
                </Link>
              </div>

              <div tabIndex={0} role="region" aria-label="Recent branch patients table" className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-2 px-3">CR Number</th>
                      <th scope="col" className="py-2 px-3">Patient</th>
                      <th scope="col" className="py-2 px-3">Severity</th>
                      <th scope="col" className="py-2 px-3">Assigned Student</th>
                      <th scope="col" className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctorData.recent_patients?.map((p: any) => {
                      const sev = (p.severity_level as SeverityLevel) || 'none';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                            {p.cr_number || p.patient_code || `PAT-${p.id}`}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {p.patient_name || p.full_name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                SEVERITY_META[sev]?.badgeClass || SEVERITY_META.none.badgeClass
                              }`}
                            >
                              {SEVERITY_META[sev]?.label || 'None'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {p.student_name ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                                {p.student_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Direct / Unassigned</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link to={`/patients/${p.id}`} className="text-teal-700 font-semibold hover:underline">
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {(!doctorData.recent_patients || doctorData.recent_patients.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No patients registered yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. STUDENT DASHBOARD VIEW */}
      {/* ===================================================================== */}
      {isStudent && studentData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">My Assigned Patients</span>
                <Users className="w-4 h-4 text-teal-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.my_patients_count ?? 0}</div>
              <Link to="/patients" className="text-[10px] text-teal-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View my assigned cases <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Records</span>
                <FileText className="w-4 h-4 text-amber-500" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.pending_records ?? 0}</div>
              <div className="text-[10px] text-amber-700 font-semibold mt-1">
                Charting / X-ray workups needed
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Upcoming Appointments</span>
                <CalendarCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
              </div>
              <div className="text-2xl font-black text-slate-900">{studentData.upcoming_appointments ?? 0}</div>
              <Link to="/appointments" className="text-[10px] text-blue-700 font-semibold hover:underline flex items-center gap-1 mt-1">
                View schedule <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">My Assigned Clinical Cases</h2>
                <p className="text-xs text-slate-400">Strictly scoped to patients assigned to you</p>
              </div>
              <Link to="/patients" className="text-xs text-teal-700 font-semibold hover:underline">
                Register / View My Patients
              </Link>
            </div>

            <div tabIndex={0} role="region" aria-label="Student assigned cases table" className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="py-2 px-3">CR Number</th>
                    <th scope="col" className="py-2 px-3">Patient Name</th>
                    <th scope="col" className="py-2 px-3">Doctor</th>
                    <th scope="col" className="py-2 px-3">Disease Categories</th>
                    <th scope="col" className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentData.recent_patients?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                        {p.cr_number || p.patient_code || `PAT-${p.id}`}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {p.patient_name || p.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.doctor_name || 'Faculty Pool'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {p.disease_categories?.slice(0, 2).map((cat: string) => (
                            <span key={cat} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              {cat}
                            </span>
                          ))}
                          {p.disease_categories?.length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{p.disease_categories.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link to={`/patients/${p.id}`} className="text-teal-700 font-semibold hover:underline">
                          Open EMR
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!studentData.recent_patients || studentData.recent_patients.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No patients assigned yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. FALLBACK OVERVIEW CARDS */}
      {/* ===================================================================== */}
      {role !== 'admin' && !isDoctorView && !isStudent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Patients</span>
              <Users className="w-4 h-4 text-teal-600" aria-hidden="true" />
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
              <span className="text-[11px] font-semibold uppercase tracking-wider">Today&apos;s Appts</span>
              <CalendarCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.today_appointments ?? 0}
            </div>
            <div className="text-[10px] text-blue-700 font-semibold mt-1">
              {summary?.upcoming_appointments ?? 0} upcoming
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Treatments</span>
              <Activity className="w-4 h-4 text-amber-500" aria-hidden="true" />
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
              <Clock className="w-4 h-4 text-purple-600" aria-hidden="true" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary?.followups_due ?? 0}
            </div>
            <div className="text-[10px] text-purple-700 font-semibold mt-1">Requires clinical review</div>
          </div>
        </div>
      )}

      {/* Main Clinical Analytics Charts (Zero financial/revenue charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Appointments by Status</h2>
            <p className="text-xs text-slate-400">Operational distribution across clinic slots</p>
          </div>
          <div className="h-60 w-full">
            {analytics?.appointments_by_status && analytics.appointments_by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.appointments_by_status} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" name="Appointments" radius={[6, 6, 0, 0]}>
                    {analytics.appointments_by_status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#14b8a6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No appointment chart data
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Treatments by Procedure</h2>
            <p className="text-xs text-slate-400">Restorative, endodontic & periodontal volume</p>
          </div>
          <div className="h-60 w-full">
            {analytics?.treatments_by_procedure && analytics.treatments_by_procedure.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={analytics.treatments_by_procedure}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="procedure_name" tick={{ fontSize: 9, fill: '#64748b' }} width={110} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" name="Procedures" fill="#0d9488" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No procedures recorded yet
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Patient Intake Trend</h2>
            <p className="text-xs text-slate-400">Newly registered PGI Dental cases over time</p>
          </div>
          <div className="h-60 w-full">
            {analytics?.patients_trend && analytics.patients_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.patients_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="new_patients"
                    name="New Patients"
                    stroke="#10b981"
                    fill="#ecfdf5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No intake trend data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Missed Patient Modal */}
      <Modal
        isOpen={isMissedModalOpen}
        onClose={() => setIsMissedModalOpen(false)}
        title="Add Missed Patient / Log Missed Appointment"
        subtitle="Marks tracker stage as Slipping and optionally triggers recall SMS/Email"
        icon={<UserMinus className="w-4 h-4 text-rose-600" aria-hidden="true" />}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmitMissedPatient} className="p-6 space-y-4">
          {missedError && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {missedError}
            </div>
          )}

          <div>
            <label htmlFor={missedPatSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
              Select Registered Patient
            </label>
            <select
              id={missedPatSelectId}
              autoFocus
              value={missedPatientId}
              onChange={(e) => setMissedPatientId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
            >
              <option value="">-- Choose Patient (or enter CR Number below) --</option>
              {branchPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || `${p.first_name} ${p.last_name}`} ({p.cr_number || p.patient_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={missedCrInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                Or Enter CR Number
              </label>
              <input
                id={missedCrInputId}
                type="text"
                value={missedCrNumber}
                onChange={(e) => setMissedCrNumber(e.target.value)}
                placeholder="e.g. CR-2026-0012"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label htmlFor={missedDateInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                Missed Date *
              </label>
              <input
                id={missedDateInputId}
                type="date"
                required
                value={missedDate}
                onChange={(e) => setMissedDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label htmlFor={missedReasonInputId} className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Observation *
            </label>
            <input
              id={missedReasonInputId}
              type="text"
              required
              value={missedReason}
              onChange={(e) => setMissedReason(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor={missedNotesInputId} className="block text-xs font-semibold text-slate-700 mb-1">
              Follow-up Notes
            </label>
            <textarea
              id={missedNotesInputId}
              rows={2}
              value={missedNotes}
              onChange={(e) => setMissedNotes(e.target.value)}
              placeholder="Optional rescheduling notes..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center gap-2.5">
            <input
              id={missedRecallId}
              type="checkbox"
              checked={sendRecallAlert}
              onChange={(e) => setSendRecallAlert(e.target.checked)}
              className="w-4 h-4 rounded border-teal-300 text-teal-600"
            />
            <label htmlFor={missedRecallId} className="text-xs font-semibold text-teal-900 cursor-pointer">
              Automatically dispatch Recall SMS & Email in patient&apos;s preferred language
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsMissedModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingMissed}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isSubmittingMissed ? 'Logging...' : 'Log Missed Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
