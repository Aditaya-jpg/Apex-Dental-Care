import { api } from './client';
import { Student } from '../types';

export interface StudentCreatePayload {
  student_name: string;
  full_name?: string;
  email: string;
  password: string;
  phone_number?: string;
  phone?: string;
  college_institution?: string;
  enrollment_number: string;
  roll_number?: string;
  year_of_study?: string;
  department?: string;
  doctor_id?: number | null;
  account_status?: string;
  is_active?: boolean;
}

export const studentsApi = {
  list: (search?: string) => {
    return api.get<Student[]>('/students', search ? { search } : undefined);
  },

  getById: (id: number) => {
    return api.get<Student>(`/students/${id}`);
  },

  create: (data: StudentCreatePayload) => {
    return api.post<Student>('/students', data);
  },

  update: (id: number, data: Partial<StudentCreatePayload>) => {
    return api.put<Student>(`/students/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete<{ message: string }>(`/students/${id}`);
  },

  revokeByEmail: (email: string) => {
    return api.delete<{ message: string }>(`/students/by-email/${encodeURIComponent(email.trim())}`);
  },
};
