import { api } from './client';
import {
  Patient,
  PaginatedResult,
  DateWiseXrayItem,
  SurgicalLog,
  SharedNotice,
  SeverityLevel,
} from '../types';

export interface PatientListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  doctorId?: number;
  studentId?: number;
  categories?: string[];
  keyword?: string;
  ageGroup?: 'all' | 'pediatric' | 'adult' | 'geriatric';
  specialCase?: boolean;
  severity?: SeverityLevel | 'all';
  scope?: 'all' | 'mine';
}

export const patientsApi = {
  list: (
    pageOrFilters: number | PatientListFilters = 1,
    pageSize = 20,
    search?: string,
    doctorId?: number,
    studentId?: number
  ) => {
    const f: PatientListFilters =
      typeof pageOrFilters === 'number'
        ? { page: pageOrFilters, pageSize, search, doctorId, studentId }
        : pageOrFilters;

    return api.get<PaginatedResult<Patient>>('/patients', {
      page: f.page ?? 1,
      page_size: f.pageSize ?? 20,
      search: f.search,
      doctor_id: f.doctorId,
      student_id: f.studentId,
      categories: f.categories && f.categories.length > 0 ? f.categories.join(',') : undefined,
      keyword: f.keyword,
      age_group: f.ageGroup && f.ageGroup !== 'all' ? f.ageGroup : undefined,
      special_case: f.specialCase ? true : undefined,
      severity: f.severity && f.severity !== 'all' ? f.severity : undefined,
      scope: f.scope,
    });
  },

  getById: (id: number) => {
    return api.get<Patient>(`/patients/${id}`);
  },

  getMyProfile: () => {
    return api.get<Patient>('/patients/my-profile');
  },

  create: (data: Partial<Patient>) => {
    return api.post<Patient>('/patients', data);
  },

  update: (id: number, data: Partial<Patient>) => {
    return api.put<Patient>(`/patients/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete<{ message: string }>(`/patients/${id}`);
  },

  getTimeline: (id: number) => {
    return api.get<any[]>(`/patients/${id}/timeline`);
  },

  getDateWiseXrays: (id: number) => {
    return api.get<DateWiseXrayItem[]>(`/patients/${id}/xrays-datewise`);
  },

  uploadDateWiseXray: (id: number, formData: FormData) => {
    return api.upload<DateWiseXrayItem>(`/patients/${id}/xrays`, formData);
  },

  uploadCard: (id: number, formData: FormData) => {
    return api.upload<Patient>(`/patients/${id}/card`, formData);
  },

  updateCardStatus: (id: number, status: string) => {
    return api.put<Patient>(`/patients/${id}/card-status`, { status });
  },

  uploadConsent: (id: number, formData: FormData) => {
    return api.upload<Patient>(`/patients/${id}/consent`, formData);
  },

  updateSeverity: (id: number, payload: { pain_scale: number; severity_level: SeverityLevel }) => {
    return api.patch<Patient>(`/patients/${id}/severity`, payload);
  },

  getSurgicalLogs: (id: number) => {
    return api.get<SurgicalLog[]>(`/patients/${id}/surgical-logs`);
  },

  createSurgicalLog: (id: number, data: Partial<SurgicalLog>) => {
    return api.post<SurgicalLog>(`/patients/${id}/surgical-logs`, data);
  },

  deleteSurgicalLog: (id: number, logId: number) => {
    return api.delete<{ message: string }>(`/patients/${id}/surgical-logs/${logId}`);
  },

  getMiscellaneous: (id: number) => {
    return api.get<Record<string, string>>(`/patients/${id}/miscellaneous`);
  },

  updateMiscellaneous: (id: number, records: Record<string, string>) => {
    return api.put<Record<string, string>>(`/patients/${id}/miscellaneous`, {
      misc_records_json: records,
      records,
    });
  },

  getSharedNotices: (id: number) => {
    return api.get<SharedNotice[]>(`/patients/${id}/shared-notices`);
  },

  createSharedNotice: (id: number, data: Partial<SharedNotice>) => {
    return api.post<SharedNotice>(`/patients/${id}/shared-notices`, data);
  },

  deleteSharedNotice: (id: number, noticeId: string) => {
    return api.delete<{ message: string }>(`/patients/${id}/shared-notices/${encodeURIComponent(noticeId)}`);
  },
};
