import { api } from './client';
import { AttendanceItem } from '../types';

export const attendanceApi = {
    getToday: async (date?: string): Promise<AttendanceItem[]> => {
        const res = await api.get<any>('/attendance/today', date ? { date } : undefined);
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.items) ? res.items : [];
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

