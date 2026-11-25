import { api } from './client';
import { Doctor } from '../types';

export const doctorsApi = {
  list: (search?: string) => {
    return api.get<Doctor[]>('/doctors', search ? { search } : undefined);
  },

  getById: (id: number) => {
    return api.get<Doctor>(`/doctors/${id}`);
  },

  create: (data: {
    doctor_name: string;
    email: string;
    password: string;
    phone_number?: string;
    qualification?: string;
    specialization?: string;
    registration_number: string;
    account_status?: string;
  }) => {
    return api.post<Doctor>('/doctors', data);
  },

  update: (id: number, data: Partial<Doctor> & { password?: string }) => {
    return api.put<Doctor>(`/doctors/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete<{ message: string }>(`/doctors/${id}`);
  },
};
