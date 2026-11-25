import { api } from './client';
import { Role, User } from '../types';

export interface UserCreatePayload {
    email: string;
    username: string;
    password: string;
    full_name: string;
    role: Role;
    is_admin?: boolean;
    phone?: string;
    is_active?: boolean;
    dentist_profile?: {
        license_number: string;
        specialization?: string;
        qualifications?: string;
        cabin_number?: string;
        is_active?: boolean;
    };
}

export interface UserUpdatePayload {
    full_name?: string;
    phone?: string;
    is_active?: boolean;
    is_admin?: boolean;
    password?: string;
    dentist_profile?: {
        license_number?: string;
        specialization?: string;
        qualifications?: string;
        cabin_number?: string;
        is_active?: boolean;
    };
}

export const usersApi = {
    getUsers: (role?: string) => {
        return api.get<User[]>('/users', role ? { role } : undefined);
    },
    list: (role?: string) => {
        return api.get<User[]>('/users', role ? { role } : undefined);
    },
    getActiveDentists: () => {
        return api.get<User[]>('/users/dentists');
    },
    getDentists: () => {
        return api.get<User[]>('/users/dentists');
    },
    createUser: (payload: UserCreatePayload) => {
        return api.post<User>('/users', payload);
    },
    create: (payload: UserCreatePayload) => {
        return api.post<User>('/users', payload);
    },
    updateUser: (id: number, payload: UserUpdatePayload) => {
        return api.put<User>(`/users/${id}`, payload);
    },
    update: (id: number, payload: UserUpdatePayload) => {
        return api.put<User>(`/users/${id}`, payload);
    },
};
