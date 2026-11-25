import { api } from './client';
import { Student } from '../types';

export const studentsApi = {
  list: (search?: string) => {
    return api.get<Student[]>('/students', search ? { search } : undefined);
  },

  getById: (id: number) => {
    return api.get<Student>(`/students/${id}`);
  },

  create: (data: {
    student_name: string;
    email: string;
    password: string;
    phone_number?: string;
    college_institution: string;
    enrollment_number: string;
    doctor_id?: number;
    account_status?: string;
  }) => {
    return api.post<Student>('/students', data);
  },

  update: (id: number, data: Partial<Student> & { password?: string }) => {
    return api.put<Student>(`/students/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete<{ message: string }>(`/students/${id}`);
  },
};
