import { api } from './client';
import { Patient, PaginatedResult, DateWiseXrayItem } from '../types';

export const patientsApi = {
  list: (page = 1, pageSize = 20, search?: string, doctorId?: number, studentId?: number) => {
    return api.get<PaginatedResult<Patient>>('/patients', {
      page,
      page_size: pageSize,
      search,
      doctor_id: doctorId,
      student_id: studentId
    });
  },

  getById: (id: number) => {
    return api.get<Patient>(`/patients/${id}`);
  },

  getMyProfile: () => {
    return api.get<Patient>('/patients/my-profile');
  },

  create: (data: Partial<Patient>) => {
    return api.post<Patient>('/patients', data);
  },

  update: (id: number, data: Partial<Patient>) => {
    return api.put<Patient>(`/patients/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete<{ message: string }>(`/patients/${id}`);
  },

  getTimeline: (id: number) => {
    return api.get<any[]>(`/patients/${id}/timeline`);
  },

  getDateWiseXrays: (id: number) => {
    return api.get<DateWiseXrayItem[]>(`/patients/${id}/xrays-datewise`);
  },

  uploadDateWiseXray: (id: number, formData: FormData) => {
    return api.upload<DateWiseXrayItem>(`/patients/${id}/xrays`, formData);
  },

  uploadCard: (id: number, formData: FormData) => {
    return api.upload<Patient>(`/patients/${id}/card`, formData);
  },

  updateCardStatus: (id: number, status: string) => {
    return api.put<Patient>(`/patients/${id}/card-status`, { status });
  },
};
