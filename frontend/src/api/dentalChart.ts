import { api } from './client';
import { DentalChartDetail, PerioChart, ToothCondition, ToothHistory } from '../types';

export interface ToothUpdatePayload {
  tooth_number: number;
  condition: string;
  severity?: string;
  surfaces?: string;
  notes?: string;
  visit_id?: number;
}

export const dentalChartApi = {
  getChart: (patientId: number) => {
    return api.get<DentalChartDetail>(`/dental-chart/${patientId}`);
  },

  updateTooth: (patientId: number, data: ToothUpdatePayload) => {
    return api.post<ToothCondition>(`/dental-chart/${patientId}/tooth`, data);
  },

  getToothHistory: (patientId: number, toothNumber: number) => {
    return api.get<ToothHistory[]>(`/dental-chart/${patientId}/tooth/${toothNumber}/history`);
  },

  getPerioChart: (patientId: number) => {
    return api.get<PerioChart>(`/dental-chart/${patientId}/perio`);
  },

  updatePerioChart: (patientId: number, data: Partial<PerioChart>) => {
    return api.put<PerioChart>(`/dental-chart/${patientId}/perio`, data);
  },
};
