import { api } from './client';
import {
    PatientPortalAppointment,
    PatientPortalPrescription,
    PatientPortalSharedItems,
} from '../types';

export const patientPortalApi = {
    getAppointments: async (): Promise<PatientPortalAppointment[]> => {
        const res = await api.get<any>('/patient-portal/appointments');
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.appointments) ? res.appointments : [];
    },

    getPrescriptions: async (): Promise<PatientPortalPrescription[]> => {
        const res = await api.get<any>('/patient-portal/prescriptions');
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.prescriptions) ? res.prescriptions : [];
    },

    getSharedItems: () => {
        return api.get<PatientPortalSharedItems>('/patient-portal/shared-items');
    },
};

