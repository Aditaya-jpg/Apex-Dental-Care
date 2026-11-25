import { api } from './client';
import { Appointment, AppointmentType } from '../types';

export const appointmentsApi = {
  list: (params?: { appointment_date?: string; dentist_id?: number; doctor_id?: number; patient_id?: number; status?: string }) => {
    return api.get<Appointment[]>('/appointments', params);
  },

  getCalendar: (params: { date: string; view: 'doctor' | 'operatory'; range?: 'day' | 'week' }) => {
    return api.get<{
      date: string;
      view: string;
      columns: { id: string | number; label: string; sublabel?: string }[];
      appointments: Appointment[];
    }>('/appointments/calendar', params);
  },

  getTypes: () => {
    return api.get<AppointmentType[]>('/appointments/types');
  },

  getById: (id: number) => {
    return api.get<Appointment>(`/appointments/${id}`);
  },

  create: (data: Partial<Appointment>) => {
    return api.post<Appointment>('/appointments', data);
  },

  update: (id: number, data: Partial<Appointment>) => {
    return api.put<Appointment>(`/appointments/${id}`, data);
  },

  updateStatus: (id: number, status: string, cancellation_reason?: string) => {
    return api.patch<Appointment>(`/appointments/${id}/status`, { status, cancellation_reason });
  },

  logMissed: (data: {
    patient_id?: number;
    cr_number?: string;
    missed_date: string;
    reason: string;
    send_recall?: boolean;
    notes?: string;
  }) => {
    return api.post<Appointment>('/appointments/missed', data);
  },

  downloadIcs: async (appointmentId: number) => {
    const blob = await api.downloadBlob(`/appointments/${appointmentId}/ics`);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PGI_Dental_Appointment_${appointmentId}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
