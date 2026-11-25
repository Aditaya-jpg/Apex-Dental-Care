import { api } from './client';
import { TrackerEnquiry, TrackerOverview, SlippingPatient, Patient, TrackerStage, LanguageCode } from '../types';

export const trackerApi = {
    getOverview: () => {
        return api.get<TrackerOverview>('/tracker/overview');
    },

    listEnquiries: (params?: { stage?: string; channel?: string }) => {
        return api.get<TrackerEnquiry[]>('/tracker/enquiries', params);
    },

    createEnquiry: (data: {
        caller_name: string;
        phone: string;
        source_channel: string;
        preferred_language?: LanguageCode;
        chief_complaint?: string;
        followup_date?: string;
        notes?: string;
        assigned_doctor_id?: number | null;
        assigned_student_id?: number | null;
    }) => {
        return api.post<TrackerEnquiry>('/tracker/enquiries', data);
    },

    updateEnquiry: (
        id: number,
        data: {
            stage?: TrackerStage;
            status?: string;
            notes?: string;
            followup_date?: string;
            assigned_doctor_id?: number | null;
            assigned_student_id?: number | null;
        }
    ) => {
        return api.patch<TrackerEnquiry>(`/tracker/enquiries/${id}`, data);
    },

    convertEnquiry: (id: number) => {
        return api.post<{ message: string; patient: Patient }>(`/tracker/enquiries/${id}/convert`);
    },

    getSlippingPatients: () => {
        return api.get<SlippingPatient[]>('/tracker/slipping');
    },
};

