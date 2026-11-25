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

  getInstructionsLibrary: (language: LanguageCode = 'en') => {
    return api.get<TreatmentInstructionTemplate[]>('/prescriptions/instructions-library', { language });
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
