import { api } from './client';
import {
    PatientPortalAppointment,
    PatientPortalPrescriptionsResponse,
    PatientPortalSharedItems,
} from '../types';

export const patientPortalApi = {
    getAppointments: async (): Promise<PatientPortalAppointment[]> => {
        const res = await api.get<any>('/patient-portal/appointments');
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.appointments) ? res.appointments : [];
    },

    getPrescriptions: async (): Promise<PatientPortalPrescriptionsResponse> => {
        const res = await api.get<any>('/patient-portal/prescriptions');
        if (Array.isArray(res)) {
            return { prescriptions: res, care_instructions: [] };
        }
        return {
            prescriptions: Array.isArray(res?.prescriptions) ? res.prescriptions : [],
            care_instructions: Array.isArray(res?.care_instructions) ? res.care_instructions : [],
        };
    },

    getSharedItems: () => {
        return api.get<PatientPortalSharedItems>('/patient-portal/shared-items');
    },
};

