import { api } from './client';
import {
    Prescription,
    MedicineCatalog,
    PrescriptionTemplate,
    TreatmentInstructionTemplate,
    LanguageCode,
} from '../types';

export const prescriptionsApi = {
    getCatalog: () => {
        return api.get<MedicineCatalog[]>('/prescriptions/catalog');
    },

    list: (params?: { patient_id?: number; dentist_id?: number }) => {
        return api.get<Prescription[]>('/prescriptions', params);
    },

    getById: (id: number) => {
        return api.get<Prescription>(`/prescriptions/${id}`);
    },

    create: (data: any) => {
        return api.post<Prescription>('/prescriptions', data);
    },

    getTemplates: () => {
        return api.get<PrescriptionTemplate[]>('/prescriptions/templates');
    },

    createTemplate: (data: Partial<PrescriptionTemplate>) => {
        return api.post<PrescriptionTemplate>('/prescriptions/templates', data);
    },

    getInstructionsLibrary: async (language: LanguageCode = 'en'): Promise<TreatmentInstructionTemplate[]> => {
        const res = await api.get<any>('/prescriptions/instructions-library', { language });
        if (Array.isArray(res)) {
            return res.map((item) => ({
                ...item,
                category: item.category || 'care_instruction',
                content: item.content || item.text || '',
                language: item.language || language,
            }));
        }
        const lang: LanguageCode = res?.language || language;
        const pre = Array.isArray(res?.pre_appointment) ? res.pre_appointment : [];
        const post = Array.isArray(res?.post_treatment) ? res.post_treatment : [];
        return [...pre, ...post].map((item: any) => ({
            key: item.key,
            category: item.category || 'pre_appointment',
            title: item.title || '',
            content: item.content || item.text || '',
            language: lang,
        }));
    },

    sendInstruction: (payload: {
        patient_id: number;
        template_key?: string;
        title: string;
        content: string;
        language: LanguageCode;
        channel?: 'portal' | 'sms' | 'email';
    }) => {
        return api.post<{ message: string }>('/prescriptions/instructions/send', payload);
    },

    downloadPdf: async (id: number, rxNumber: string) => {
        const blob = await api.downloadBlob(`/prescriptions/${id}/pdf`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Prescription_${rxNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
};
