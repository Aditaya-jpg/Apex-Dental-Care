import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MessageCircle,
  LayoutGrid,
  List,
  DoorOpen,
} from 'lucide-react';
import { appointmentsApi } from '../api/appointments';
import { doctorsApi } from '../api/doctors';
import { useAuth } from '../context/AuthContext';
import AppointmentModal from '../components/appointments/AppointmentModal';
import VisitModal from '../components/clinical/VisitModal';
import { Appointment, Doctor } from '../types';
import { buildGoogleCalendarUrl, buildWhatsAppShareUrl, formatDateIN } from '../utils/formatters';

const TIME_SLOTS = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
  '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

const OPERATORIES = ['Operatory 1', 'Operatory 2', 'Operatory 3', 'Operatory 4'];

const add30Mins = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + 30;
  const nh = Math.floor(total / 60).toString().padStart(2, '0');
  const nm = (total % 60).toString().padStart(2, '0');
  return `${nh}:${nm}:00`;
};

export default function Appointments() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canStartVisit = hasRole('admin', 'doctor', 'dentist', 'student');

  const [viewMode, setViewMode] = useState<'doctor' | 'operatory' | 'list'>('doctor');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [slotPrefill, setSlotPrefill] = useState<{
    startTime?: string;
    endTime?: string;
    doctorId?: number;
    operatory?: string;
  }>({});
  const [activeAppointmentForVisit, setActiveAppointmentForVisit] = useState<Appointment | null>(null);

  const dateInputId = useId();
  const docFilterId = useId();
  const statusFilterId = useId();
  const searchInputId = useId();

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctorsForCalendar'],
    queryFn: () => doctorsApi.list().catch(() => []),
  });

  const { data: calendarData } = useQuery({
    queryKey: ['smartCalendar', selectedDate, viewMode],
    queryFn: () =>
      appointmentsApi
        .getCalendar({
          date: selectedDate || new Date().toISOString().slice(0, 10),
          view: viewMode === 'operatory' ? 'operatory' : 'doctor',
          range: 'day',
        })
        .catch(() => null),
    enabled: viewMode !== 'list',
  });

  const { data: appointmentsList = [], isLoading, error } = useQuery({
    queryKey: ['appointments', selectedDate, selectedDoctor, selectedStatus],
    queryFn: () =>
      appointmentsApi.list({
        appointment_date: selectedDate || undefined,
        doctor_id: selectedDoctor !== 'all' ? Number(selectedDoctor) : undefined,
        dentist_id: selectedDoctor !== 'all' ? Number(selectedDoctor) : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['smartCalendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const handlePrevDay = () => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setDate(base.getDate() - 1);
    setSelectedDate(base.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setDate(base.getDate() + 1);
    setSelectedDate(base.toISOString().split('T')[0]);
  };

  const sourceAppointments: Appointment[] =
    viewMode !== 'list' && calendarData?.appointments && calendarData.appointments.length > 0
      ? calendarData.appointments
      : appointmentsList;

  const filteredAppointments = sourceAppointments.filter((app: Appointment) => {
    if (selectedStatus !== 'all' && app.status !== selectedStatus) return false;
    if (selectedDoctor !== 'all') {
      const dId = app.doctor_id || app.dentist_id;
      if (String(dId) !== selectedDoctor) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const patientName = (
      app.patient_name ||
      `${app.patient?.first_name || ''} ${app.patient?.last_name || ''}`
    ).toLowerCase();
    const cr = (app.cr_number || app.patient_code || '').toLowerCase();
    const doctorName = (app.doctor_name || app.dentist_name || '').toLowerCase();
    const reason = (app.reason || '').toLowerCase();
    return (
      patientName.includes(q) ||
      cr.includes(q) ||
      doctorName.includes(q) ||
      reason.includes(q)
    );
  });

  const totalCount = filteredAppointments.length;
  const confirmedCount = filteredAppointments.filter((a) => a.status === 'confirmed').length;
  const completedCount = filteredAppointments.filter((a) => a.status === 'completed').length;
  const cancelledCount = filteredAppointments.filter(
    (a) => a.status === 'cancelled' || a.status === 'no_show'
  ).length;

  const doctorColumns: { id: number | string; label: string; sublabel?: string }[] =
    calendarData?.columns && viewMode === 'doctor' && calendarData.columns.length > 0
      ? calendarData.columns
      : doctors.length > 0
      ? doctors.map((d: Doctor) => ({
          id: d.id,
          label: d.full_name || d.doctor_name,
          sublabel: d.cabin_operatory || d.specialization,
        }))
      : [{ id: 1, label: 'Attending Doctor', sublabel: 'Operatory 1' }];

  const operatoryColumns: { id: string; label: string; sublabel?: string }[] =
    calendarData?.columns && viewMode === 'operatory' && calendarData.columns.length > 0
      ? (calendarData.columns as any)
      : OPERATORIES.map((op) => ({ id: op, label: op, sublabel: 'PGI Dental Chair' }));

  const activeColumns = viewMode === 'doctor' ? doctorColumns : operatoryColumns;

  const getSlotColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-50 border-emerald-300 text-emerald-950';
      case 'checked_in':
      case 'in_progress':
        return 'bg-cyan-50 border-cyan-300 text-cyan-950';
      case 'completed':
        return 'bg-blue-50 border-blue-300 text-blue-950';
      case 'cancelled':
      case 'no_show':
        return 'bg-rose-50 border-rose-300 text-rose-900';
      default:
        return 'bg-teal-50 border-teal-300 text-teal-950';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Confirmed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Cancelled
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Missed / No-Show
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <Clock className="w-3 h-3 mr-1" aria-hidden="true" /> {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const openBookWithPrefill = (prefill: typeof slotPrefill = {}) => {
    setSlotPrefill(prefill);
    setIsBookModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            PGI Smart Calendar & Operatory Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Doctor-wise & Operatory-wise scheduling with conflict locking, Google Calendar links & .ics export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('doctor')}
              className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition ${
                viewMode === 'doctor' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Doctor View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('operatory')}
              className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition ${
                viewMode === 'operatory' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Operatory View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition ${
                viewMode === 'list' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" aria-hidden="true" />
              <span>List View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openBookWithPrefill({})}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-teal-600 rounded-xl shadow-sm hover:bg-teal-700 transition"
          >
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Book Appointment
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
          </div>
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
            <CalendarIcon className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{confirmedCount}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{completedCount}</div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Stethoscope className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cancelled / Missed</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{cancelledCount}</div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <XCircle className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Date Navigation & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous day"
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <label htmlFor={dateInputId} className="visually-hidden">
              Select calendar date
            </label>
            <input
              id={dateInputId}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
            />
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Next day"
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Today
          </button>
          {viewMode === 'list' && (
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                !selectedDate ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              All Dates
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor={docFilterId} className="text-xs font-medium text-slate-500">
              Doctor:
            </label>
            <select
              id={docFilterId}
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name || d.doctor_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor={statusFilterId} className="text-xs font-medium text-slate-500">
              Status:
            </label>
            <select
              id={statusFilterId}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">Missed / No-Show</option>
            </select>
          </div>

          <div className="relative">
            <label htmlFor={searchInputId} className="visually-hidden">
              Search appointments
            </label>
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
            <input
              id={searchInputId}
              type="search"
              placeholder="Search patient, CR #, doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* SMART CALENDAR MATRIX (Doctor View & Operatory View) */}
      {viewMode !== 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">
              {viewMode === 'doctor' ? 'Doctor-Wise Smart Calendar' : 'Operatory-Wise Smart Calendar'} —{' '}
              {selectedDate ? formatDateIN(selectedDate) : 'Today'}
            </span>
            <span className="text-slate-500">Click any empty 30-min slot to book</span>
          </div>

          <div tabIndex={0} role="region" aria-label="Smart calendar schedule grid" className="overflow-x-auto">
            <table className="min-w-[740px] w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-slate-50 py-3 px-3 border-r border-slate-200 w-24"
                  >
                    Time
                  </th>
                  {activeColumns.map((col) => (
                    <th key={col.id} scope="col" className="py-3 px-3 border-r border-slate-100 min-w-[170px]">
                      <div className="text-slate-900">{col.label}</div>
                      {col.sublabel && (
                        <div className="text-[10px] font-medium text-teal-700">{col.sublabel}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="hover:bg-slate-50/40">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-slate-50 py-3 px-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap"
                    >
                      {slot}
                    </th>
                    {activeColumns.map((col) => {
                      const slotAppts = filteredAppointments.filter((a) => {
                        const startHHMM = (a.start_time || '').slice(0, 5);
                        if (startHHMM !== slot) return false;
                        if (viewMode === 'doctor') {
                          return String(a.doctor_id || a.dentist_id) === String(col.id);
                        }
                        return (a.operatory || 'Operatory 1') === String(col.id);
                      });

                      return (
                        <td key={col.id} className="p-1.5 border-r border-slate-100 align-top">
                          {slotAppts.length === 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                openBookWithPrefill({
                                  startTime: `${slot}:00`,
                                  endTime: add30Mins(slot),
                                  doctorId: viewMode === 'doctor' ? Number(col.id) : undefined,
                                  operatory: viewMode === 'operatory' ? String(col.id) : undefined,
                                })
                              }
                              aria-label={`Book slot ${slot} with ${col.label}`}
                              className="w-full h-11 rounded-lg border border-dashed border-transparent hover:border-teal-300 hover:bg-teal-50/50 text-[10px] text-transparent hover:text-teal-700 font-semibold transition flex items-center justify-center"
                            >
                              + Book {slot}
                            </button>
                          ) : (
                            <div className="space-y-1.5">
                              {slotAppts.map((a) => {
                                const gCal =
                                  a.google_calendar_url ||
                                  buildGoogleCalendarUrl({
                                    title: `PGI Dental: ${a.patient_name || `Patient #${a.patient_id}`}`,
                                    date: a.appointment_date,
                                    startTime: a.start_time,
                                    endTime: a.end_time,
                                    location: `${a.operatory || 'Operatory 1'}, PGIMER Chandigarh`,
                                  });
                                return (
                                  <div
                                    key={a.id}
                                    className={`p-2 rounded-lg border text-[11px] space-y-1 ${getSlotColor(
                                      a.status
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <Link
                                        to={`/patients/${a.patient_id}`}
                                        className="font-bold hover:underline truncate"
                                      >
                                        {a.patient_name || `Patient #${a.patient_id}`}
                                      </Link>
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/80">
                                        {a.status}
                                      </span>
                                    </div>
                                    <div className="text-[10px] opacity-80 truncate">
                                      {viewMode === 'doctor'
                                        ? a.operatory || 'Operatory 1'
                                        : a.doctor_name || a.dentist_name || 'Doctor'}
                                      {a.reason ? ` • ${a.reason}` : ''}
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <a
                                        href={gCal}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] font-semibold underline inline-flex items-center gap-0.5"
                                      >
                                        GCal <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => appointmentsApi.downloadIcs(a.id)}
                                        className="text-[10px] font-semibold underline"
                                      >
                                        .ics
                                      </button>
                                      {canStartVisit && a.status !== 'cancelled' && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveAppointmentForVisit(a)}
                                          className="ml-auto px-1.5 py-0.5 rounded bg-white text-teal-800 font-bold text-[10px]"
                                        >
                                          Exam
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500">Loading schedule...</div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 text-xs">Failed to load appointments.</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">No appointments scheduled.</div>
          ) : (
            <div tabIndex={0} role="region" aria-label="Appointments list table" className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4">Date & Time</th>
                    <th scope="col" className="py-3 px-4">Patient</th>
                    <th scope="col" className="py-3 px-4">Doctor & Operatory</th>
                    <th scope="col" className="py-3 px-4">Type / Reason</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Sync & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((app: Appointment) => {
                    const pName =
                      app.patient_name ||
                      (app.patient ? `${app.patient.first_name} ${app.patient.last_name}` : `Patient #${app.patient_id}`);
                    const gCal =
                      app.google_calendar_url ||
                      buildGoogleCalendarUrl({
                        title: `PGI Dental Appointment — ${pName}`,
                        date: app.appointment_date,
                        startTime: app.start_time,
                        endTime: app.end_time,
                        details: app.reason || 'PGI Dental Consultation',
                        location: `${app.operatory || 'Operatory 1'}, Oral Health Sciences Centre, PGIMER Chandigarh`,
                      });
                    const waReminder = `Reminder from PGI Dental Branch (PGIMER Chandigarh): ${pName}, your dental appointment is on ${formatDateIN(
                      app.appointment_date
                    )} at ${(app.start_time || '').slice(0, 5)} (${app.operatory || 'Operatory 1'}).`;

                    return (
                      <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {(app.start_time || '').substring(0, 5)} - {(app.end_time || '').substring(0, 5)}
                          </div>
                          <div className="text-[11px] text-slate-500">{formatDateIN(app.appointment_date)}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/patients/${app.patient_id}`}
                            className="font-bold text-teal-700 hover:underline"
                          >
                            {pName}
                          </Link>
                          <div className="text-[11px] font-mono text-slate-500">
                            {app.cr_number || app.patient_code || `ID #${app.patient_id}`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-800 font-semibold">
                            {app.doctor_name || app.dentist_name || 'Attending Doctor'}
                          </div>
                          <div className="text-[11px] text-teal-700 font-medium">
                            {app.operatory || 'Operatory 1'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-slate-700">
                            {(app.appointment_type_name || (typeof app.appointment_type === 'string' ? app.appointment_type : '') || 'Consultation').replace(/_/g, ' ')}
                          </div>
                          {app.reason && <div className="text-[11px] text-slate-500 truncate">{app.reason}</div>}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(app.status)}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={gCal}
                              target="_blank"
                              rel="noreferrer"
                              title="Add to Google Calendar"
                              className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                            >
                              GCal
                            </a>
                            <button
                              type="button"
                              onClick={() => appointmentsApi.downloadIcs(app.id)}
                              title="Download .ics calendar invite"
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" aria-hidden="true" />
                              .ics
                            </button>
                            <a
                              href={buildWhatsAppShareUrl(app.patient?.phone, waReminder)}
                              target="_blank"
                              rel="noreferrer"
                              title="Send WhatsApp Reminder"
                              className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                            >
                              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                            {canStartVisit && app.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => setActiveAppointmentForVisit(app)}
                                className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md"
                              >
                                <Stethoscope className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                Visit
                              </button>
                            )}
                            {(app.status === 'scheduled' || app.status === 'confirmed') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'completed' })}
                                  aria-label="Mark completed"
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm('Cancel this appointment?')) {
                                      updateStatusMutation.mutate({ id: app.id, status: 'cancelled' });
                                    }
                                  }}
                                  aria-label="Cancel appointment"
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                >
                                  <XCircle className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </>
                            )}
                            <Link
                              to={`/patients/${app.patient_id}`}
                              aria-label="View patient record"
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            >
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isBookModalOpen && (
        <AppointmentModal
          isOpen={isBookModalOpen}
          onClose={() => setIsBookModalOpen(false)}
          defaultDate={selectedDate || new Date().toISOString().split('T')[0]}
          defaultStartTime={slotPrefill.startTime}
          defaultEndTime={slotPrefill.endTime}
          defaultDoctorId={slotPrefill.doctorId}
          defaultOperatory={slotPrefill.operatory}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['smartCalendar'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
          }}
        />
      )}

      {activeAppointmentForVisit && (
        <VisitModal
          isOpen={!!activeAppointmentForVisit}
          onClose={() => setActiveAppointmentForVisit(null)}
          patientId={activeAppointmentForVisit.patient_id}
          patientName={activeAppointmentForVisit.patient_name}
          appointmentId={activeAppointmentForVisit.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            navigate(`/patients/${activeAppointmentForVisit.patient_id}`);
          }}
        />
      )}
    </div>
  );
}
