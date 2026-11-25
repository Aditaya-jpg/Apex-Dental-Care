import { api } from './client';
import { Doctor } from '../types';

export interface DoctorCreatePayload {
    doctor_name: string;
    full_name?: string;
    email: string;
    password: string;
    phone_number?: string;
    phone?: string;
    qualification?: string;
    specialization?: string;
    department?: string;
    registration_number: string;
    license_number?: string;
    cabin_operatory?: string;
    is_admin?: boolean;
    account_status?: string;
    is_active?: boolean;
}

export const doctorsApi = {
    list: (search?: string) => {
        return api.get<Doctor[]>('/doctors', search ? { search } : undefined);
    },

    getById: (id: number) => {
        return api.get<Doctor>(`/doctors/${id}`);
    },

    create: (data: DoctorCreatePayload) => {
        return api.post<Doctor>('/doctors', data);
    },

    update: (id: number, data: Partial<DoctorCreatePayload>) => {
        return api.put<Doctor>(`/doctors/${id}`, data);
    },

    delete: (id: number) => {
        return api.delete<{ message: string }>(`/doctors/${id}`);
    },
};
