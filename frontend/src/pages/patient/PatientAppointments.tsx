import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Download,
  ExternalLink,
  Info,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { patientPortalApi } from '../../api/patientPortal';
import { appointmentsApi } from '../../api/appointments';
import { PatientPortalAppointment } from '../../types';
import { formatDateIN, buildGoogleCalendarUrl } from '../../utils/formatters';

export const PatientAppointments: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['patient-portal-appointments'],
    queryFn: () => patientPortalApi.getAppointments(),
  });

  const today = new Date().toISOString().split('T')[0];

  const filtered = appointments.filter((appt) => {
    const isUpcoming =
      appt.appointment_date >= today &&
      !['completed', 'cancelled', 'missed', 'no_show'].includes(appt.status);
    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'past') return !isUpcoming;
    return true;
  });

  const handleDownloadIcs = async (apptId: number) => {
    setDownloadingId(apptId);
    setActionError(null);
    try {
      await appointmentsApi.downloadIcs(apptId);
    } catch (err: any) {
      setActionError(err?.message || 'Unable to download calendar file right now.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'scheduled':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'checked_in':
      case 'in_progress':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled':
      case 'missed':
      case 'no_show':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Visits & Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Oral Health Sciences Centre, PGIMER Chandigarh — scheduled chairs and preparation notes.
          </p>
        </div>

        <div
          className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto"
          role="tablist"
          aria-label="Filter appointments"
        >
          {(['all', 'upcoming', 'past'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  active
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Unable to load appointments. Please refresh the page.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">No appointments in this view</h2>
          <p className="text-sm text-slate-500 mt-1">
            Scheduled visits at PGI Dental Branch will appear here with calendar sync links.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((appt: PatientPortalAppointment) => {
            const gcalUrl =
              appt.google_calendar_url ||
              buildGoogleCalendarUrl({
                title: `PGI Dental Visit — ${appt.appointment_type || 'Consultation'}`,
                date: appt.appointment_date,
                startTime: appt.start_time,
                endTime: appt.end_time,
                details: appt.pre_appointment_instructions
                  ? `Doctor: ${appt.doctor_display_name}\nInstructions: ${appt.pre_appointment_instructions}`
                  : `Doctor: ${appt.doctor_display_name} — PGI Dental Branch`,
                location: appt.operatory
                  ? `${appt.operatory}, Oral Health Sciences Centre, PGIMER Chandigarh`
                  : 'Oral Health Sciences Centre, PGIMER Chandigarh',
              });

            const canAddCalendar = !['cancelled', 'missed', 'no_show'].includes(appt.status);

            return (
              <article
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-colors hover:border-teal-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getStatusBadge(
                          appt.status
                        )}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        {appt.status.replace('_', ' ')}
                      </span>
                      {appt.department && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {appt.department}
                        </span>
                      )}
                      {appt.appointment_type && (
                        <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                          {appt.appointment_type}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true" />
                        <span className="font-semibold text-slate-900">
                          {formatDateIN(appt.appointment_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true" />
                        <span>
                          {appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{appt.doctor_display_name}</span>
                      </div>
                    </div>

                    {appt.operatory && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                        <span>{appt.operatory} · Oral Health Sciences Centre, PGIMER Chandigarh</span>
                      </div>
                    )}

                    {appt.pre_appointment_instructions && (
                      <div className="mt-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <span className="font-semibold block text-amber-950 mb-0.5">
                            Pre-Visit Preparation Instructions
                          </span>
                          <p className="leading-relaxed">{appt.pre_appointment_instructions}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {canAddCalendar && (
                    <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2 flex-shrink-0 pt-2 lg:pt-0">
                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Add to Google Calendar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDownloadIcs(appt.id)}
                        disabled={downloadingId === appt.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{downloadingId === appt.id ? 'Preparing…' : 'Download .ics'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientAppointments;
