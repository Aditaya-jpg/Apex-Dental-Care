import { api } from './client';
import {
  NotificationLog,
  RecallItem,
  PreventiveCareMessage,
  SocialSettings,
  LanguageCode,
} from '../types';

export const notificationsApi = {
  getSettings: () => {
    return api.get<SocialSettings>('/notifications/settings');
  },

  updateSettings: (data: Partial<SocialSettings>) => {
    return api.put<SocialSettings>('/notifications/settings', data);
  },

  getLogs: (params?: { channel?: string; status?: string }) => {
    return api.get<NotificationLog[]>('/notifications/logs', params);
  },

  sendNotification: (payload: {
    patient_id: number;
    channel: 'sms' | 'email';
    language: LanguageCode;
    title?: string;
    message_body: string;
    category?: string;
  }) => {
    return api.post<NotificationLog>('/notifications/send', payload);
  },

  listRecalls: () => {
    return api.get<RecallItem[]>('/notifications/recalls');
  },

  generateRecalls: () => {
    return api.post<{ generated_count: number; message: string }>('/notifications/recalls/generate');
  },

  dispatchDueRecalls: () => {
    return api.post<{ dispatched_count: number; message: string }>('/notifications/recalls/dispatch-due');
  },

  previewPreventiveCare: (patientId: number, language: LanguageCode = 'en') => {
    return api.get<PreventiveCareMessage>(`/notifications/preventive-care/preview/${patientId}`, {
      language,
    });
  },

  sendPreventiveCare: (payload: {
    patient_id: number;
    language: LanguageCode;
    channel?: 'sms' | 'email' | 'whatsapp';
    custom_message?: string;
  }) => {
    return api.post<{ message: string; log?: NotificationLog }>('/notifications/preventive-care/send', payload);
  },
};
