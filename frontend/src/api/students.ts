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

export interface StudentWorkspacePatient {
    id: number;
    cr_number?: string;
    patient_code: string;
    full_name: string;
    age?: number;
    gender?: string;
    phone?: string;
    severity_level: string;
    pain_scale: number;
    tracker_stage: string;
    disease_categories: string[];
    attending_doctor?: string | null;
    visits_count: number;
    treatment_plans_count: number;
    surgical_logs_count: number;
    latest_plan_status?: string | null;
    last_visit_date?: string | null;
    last_visit_diagnosis?: string | null;
    next_appointment_date?: string | null;
}

export interface StudentWorkspaceActivity {
    id: number;
    record_type: string;
    record_date?: string | null;
    title: string;
    status?: string | null;
    patient_id?: number | null;
    patient_name: string;
    cr_number?: string | null;
}

export interface StudentWorkspace {
    student: Student;
    summary: {
        assigned_patients: number;
        visits_recorded: number;
        treatment_plans: number;
        surgical_logs: number;
        prescriptions: number;
        upcoming_appointments: number;
        missed_appointments: number;
    };
    patients: StudentWorkspacePatient[];
    recent_activity: StudentWorkspaceActivity[];
}

export const studentsApi = {
    list: (search?: string) => {
        return api.get<Student[]>('/students', search ? { search } : undefined);
    },

    getById: (id: number) => {
        return api.get<Student>(`/students/${id}`);
    },

    getWorkspace: (id: number) => {
        return api.get<StudentWorkspace>(`/students/${id}/workspace`);
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
