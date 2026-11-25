import { api } from './client';
import {
    PatientPortalAppointment,
    PatientPortalPrescription,
    PatientPortalSharedItems,
} from '../types';

export const patientPortalApi = {
    getAppointments: () => {
        return api.get<PatientPortalAppointment[]>('/patient-portal/appointments');
    },

    getPrescriptions: () => {
        return api.get<PatientPortalPrescription[]>('/patient-portal/prescriptions');
    },

    getSharedItems: () => {
        return api.get<PatientPortalSharedItems>('/patient-portal/shared-items');
    },
};

