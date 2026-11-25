import { api } from './client';
import { DocumentItem, TreatmentStage } from '../types';

export interface DocumentUploadOptions {
    patientId: number;
    documentType: string;
    file: File;
    title?: string;
    notes?: string;
    description?: string;
    diseaseCategory?: string;
    treatmentStage?: TreatmentStage;
    mediaDate?: string;
    isSharedWithPatient?: boolean;
    visitId?: number;
    clinicalRecordId?: number;
}

export const documentsApi = {
    listAll: (documentType?: string) => {
        return api.get<DocumentItem[]>('/documents', documentType ? { document_type: documentType } : undefined);
    },

    getPatientDocuments: (patientId: number) => {
        return api.get<DocumentItem[]>(`/documents/patient/${patientId}`);
    },

    upload: (optsOrPatientId: number | DocumentUploadOptions, documentType?: string, file?: File, visitId?: number, notes?: string) => {
        const opts: DocumentUploadOptions =
            typeof optsOrPatientId === 'number'
                ? {
                    patientId: optsOrPatientId,
                    documentType: documentType || 'other',
                    file: file as File,
                    visitId,
                    notes,
                }
                : optsOrPatientId;

        const formData = new FormData();
        formData.append('patient_id', String(opts.patientId));
        formData.append('document_type', opts.documentType);
        formData.append('file', opts.file);
        if (opts.title) formData.append('title', opts.title);
        if (opts.description || opts.notes) formData.append('description', opts.description || opts.notes || '');
        if (opts.notes) formData.append('notes', opts.notes);
        if (opts.diseaseCategory) formData.append('disease_category', opts.diseaseCategory);
        if (opts.treatmentStage) formData.append('treatment_stage', opts.treatmentStage);
        if (opts.mediaDate) formData.append('media_date', opts.mediaDate);
        if (opts.isSharedWithPatient !== undefined) {
            formData.append('is_shared_with_patient', String(opts.isSharedWithPatient));
        }
        if (opts.visitId) formData.append('visit_id', String(opts.visitId));
        if (opts.clinicalRecordId) formData.append('clinical_record_id', String(opts.clinicalRecordId));

        return api.upload<DocumentItem>('/documents/upload', formData);
    },

    toggleShare: (documentId: number, isSharedWithPatient: boolean) => {
        return api.patch<DocumentItem>(`/documents/${documentId}/share`, {
            is_shared_with_patient: isSharedWithPatient,
        });
    },

    fetchBlobUrl: async (documentId: number): Promise<string> => {
        const blob = await api.downloadBlob(`/documents/${documentId}/download`);
        return window.URL.createObjectURL(blob);
    },

    download: async (documentId: number, filename: string) => {
        const blob = await api.downloadBlob(`/documents/${documentId}/download`);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
};
