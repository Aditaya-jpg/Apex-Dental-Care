import React, { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { attendanceApi } from '../api/attendance';
import { AttendanceItem } from '../types';

export default function Attendance() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [walkinIdentifier, setWalkinIdentifier] = useState('');
  const [walkinNotes, setWalkinNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dateId = useId();
  const searchId = useId();
  const walkinId = useId();
  const walkinNoteId = useId();

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['attendanceToday', selectedDate],
    queryFn: () => attendanceApi.getToday(selectedDate),
  });

  const markMutation = useMutation({
    mutationFn: ({
      appointmentId,
      status,
    }: {
      appointmentId: number;
      status: 'checked_in' | 'present' | 'missed' | 'completed';
    }) => attendanceApi.markAttendance(appointmentId, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      setFeedback({
        type: 'success',
        text: `Attendance updated for ${updated.full_name}: ${updated.attendance_status.replace(/_/g, ' ').toUpperCase()}.`,
      });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', text: err.message || 'Failed to update attendance.' });
    },
  });

  const walkinMutation = useMutation({
    mutationFn: attendanceApi.walkinCheckin,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      setWalkinIdentifier('');
      setWalkinNotes('');
      setFeedback({
        type: 'success',
        text: `Walk-in checked in: ${res.full_name} (${res.cr_number || res.patient_code}).`,
      });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', text: err.message || 'Patient CR Number / Code not found.' });
    },
  });

  const handleWalkinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinIdentifier.trim()) return;
    walkinMutation.mutate({
      identifier: walkinIdentifier.trim(),
      notes: walkinNotes.trim() || undefined,
    });
  };

  const filteredItems = items.filter((item: AttendanceItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.full_name || '').toLowerCase().includes(q) ||
      (item.cr_number || '').toLowerCase().includes(q) ||
      (item.patient_code || '').toLowerCase().includes(q) ||
      (item.phone || '').toLowerCase().includes(q) ||
      (item.doctor_name || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    total: filteredItems.length,
    checkedIn: filteredItems.filter((i) => i.attendance_status === 'checked_in' || i.attendance_status === 'present').length,
    completed: filteredItems.filter((i) => i.attendance_status === 'completed').length,
    missed: filteredItems.filter((i) => i.attendance_status === 'missed').length,
  };

  const getBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
      case 'present':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
            {status.replace(/_/g, ' ')}
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
            Completed
          </span>
        );
      case 'missed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase">
            Missed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
            Pending Arrival
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              PGI Reception & Patient Attendance Desk
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark scheduled arrival statuses and log walk-in CR Number check-ins. Clinical EMR records remain restricted.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="px-3.5 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex justify-between items-center ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Total Appointments</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{counts.total}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-emerald-700">Checked-In / Present</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{counts.checkedIn}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-blue-700">Completed</span>
          <div className="text-2xl font-black text-blue-700 mt-1">{counts.completed}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-rose-700">Missed</span>
          <div className="text-2xl font-black text-rose-700 mt-1">{counts.missed}</div>
        </div>
      </div>

      {/* Walk-In Check-in Card + Date/Search Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleWalkinSubmit}
          className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" aria-hidden="true" />
            <span>Walk-In Patient Check-In (CR No / Patient Code)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={walkinId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                CR Number or Patient Code *
              </label>
              <input
                id={walkinId}
                type="text"
                required
                value={walkinIdentifier}
                onChange={(e) => setWalkinIdentifier(e.target.value)}
                placeholder="e.g. CR-2026-0001 or P-1001"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label htmlFor={walkinNoteId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Reception Desk Note
              </label>
              <input
                id={walkinNoteId}
                type="text"
                value={walkinNotes}
                onChange={(e) => setWalkinNotes(e.target.value)}
                placeholder="e.g. Arrived at OPD counter"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={walkinMutation.isPending}
            className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {walkinMutation.isPending ? 'Checking In...' : 'Mark Walk-In Check-In'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Filter Attendance Register</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={dateId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Attendance Date
              </label>
              <input
                id={dateId}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor={searchId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Search CR No, Name, Phone or Doctor
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
                <input
                  id={searchId}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search queue..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading today&apos;s attendance queue...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No scheduled appointments found for {selectedDate}.
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-label="Patient attendance register" className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="visually-hidden">Today&apos;s PGI Dental patient attendance queue</caption>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-3 px-4">CR Number / Code</th>
                  <th scope="col" className="py-3 px-4">Patient & Phone</th>
                  <th scope="col" className="py-3 px-4">Time & Operatory</th>
                  <th scope="col" className="py-3 px-4">Doctor</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4 text-right">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.appointment_id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-teal-800">
                      {item.cr_number || item.patient_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.full_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{item.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                        {(item.start_time || '').slice(0, 5)}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.operatory || 'Operatory 1'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{item.doctor_name}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getBadge(item.attendance_status)}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            markMutation.mutate({
                              appointmentId: item.appointment_id,
                              status: 'checked_in',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold"
                        >
                          Check In
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            markMutation.mutate({
                              appointmentId: item.appointment_id,
                              status: 'present',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            markMutation.mutate({
                              appointmentId: item.appointment_id,
                              status: 'completed',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            markMutation.mutate({
                              appointmentId: item.appointment_id,
                              status: 'missed',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold inline-flex items-center gap-1"
                        >
                          <UserX className="w-3 h-3" aria-hidden="true" />
                          Missed
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
