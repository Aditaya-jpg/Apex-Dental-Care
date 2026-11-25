import { api } from './client';
import { SocialSettings, TrackerEnquiry, LanguageCode } from '../types';

export const integrationsApi = {
  getSocialSettings: () => {
    return api.get<SocialSettings>('/integrations/social-settings');
  },

  updateSocialSettings: (data: Partial<SocialSettings>) => {
    return api.put<SocialSettings>('/integrations/social-settings', data);
  },

  submitSocialLead: (payload: {
    caller_name: string;
    phone: string;
    source_channel: 'whatsapp' | 'instagram' | 'facebook';
    message: string;
    preferred_language?: LanguageCode;
  }) => {
    return api.post<{ message: string; enquiry: TrackerEnquiry }>('/integrations/social-lead', payload);
  },
};
