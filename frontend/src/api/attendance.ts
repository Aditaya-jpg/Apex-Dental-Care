import { api } from './client';
import { AttendanceItem } from '../types';

export const attendanceApi = {
  getToday: (date?: string) => {
    return api.get<AttendanceItem[]>('/attendance/today', date ? { date } : undefined);
  },

  markAttendance: (
    appointmentId: number,
    payload: { status: 'checked_in' | 'present' | 'missed' | 'completed'; notes?: string }
  ) => {
    return api.patch<AttendanceItem>(`/attendance/${appointmentId}/mark`, payload);
  },

  walkinCheckin: (payload: { identifier: string; notes?: string }) => {
    return api.post<AttendanceItem>('/attendance/walkin-checkin', payload);
  },
};
