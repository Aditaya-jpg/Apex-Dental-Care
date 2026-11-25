import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
} from 'lucide-react';
import { appointmentsApi } from '../../api/appointments';
import { Appointment } from '../../types';
import { formatDateIN } from '../../utils/formatters';

export default function PatientAppointments() {
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['patientMyAppointments'],
    queryFn: () => appointmentsApi.list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              My Dental Appointments
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled clinical checkups, treatment sessions, and past consultations.
            </p>
          </div>
        </div>
      </div>



      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-2" />
            <span>Loading appointments...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No appointments scheduled</p>
            <p className="text-xs text-slate-400">Contact the clinic reception to schedule your next visit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-teal-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                    {appt.appointment_type_name || 'Consultation'}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      appt.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : appt.status === 'completed'
                        ? 'bg-slate-100 text-slate-700'
                        : appt.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {appt.dentist_name || 'Assigned Dental Specialist'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {appt.reason || 'Routine Dental Checkup'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                    {formatDateIN(appt.appointment_date)}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    {appt.start_time.slice(0, 5)} - {appt.end_time.slice(0, 5)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
