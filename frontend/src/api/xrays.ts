import { api } from './client';

export interface XraySample {
  id: string;
  title: string;
  description: string;
  type: string;
  thumbnail: string;
}

export interface XrayEngineStatus {
  status: 'online' | 'standby' | 'error';
  service: string;
  engine_url: string;
  device?: string;
  checkpoint_loaded: boolean;
  details?: Record<string, any>;
}

export interface ReconstructMetrics {
  vertices: number;
  faces: number;
  arch_width_mm: number;
  arch_height_mm: number;
  arch_depth_mm: number;
  volume_cm3: number;
  threshold_used?: number;
  resolution?: string;
  latency_ms?: number;
  device?: string;
}

export interface ReconstructResponse {
  success: boolean;
  session_id: string;
  input_scan_url: string;
  model_urls: {
    glb: string;
    obj: string;
    stl: string;
    nii: string;
  };
  slices: {
    axial: string;
    coronal: string;
    sagittal: string;
    max_indices: {
      axial: number;
      coronal: number;
      sagittal: number;
    };
  };
  metrics: ReconstructMetrics;
  saved_document_id?: number;
}

export interface PatientXrayItem {
  id: number;
  patient_id: number;
  document_type: string;
  file_name: string;
  original_file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  created_at: string;
  notes?: any;
}

export const xraysApi = {
  getStatus: () => api.get<XrayEngineStatus>('/xrays/status'),

  getSamples: () => api.get<XraySample[]>('/xrays/samples'),

  reconstruct: (formData: FormData) =>
    api.upload<ReconstructResponse>('/xrays/reconstruct', formData),

  saveToPatient: (payload: {
    patient_id: number;
    session_id: string;
    title?: string;
    notes?: string;
    model_urls: Record<string, string>;
    metrics: Record<string, any>;
    input_scan_url?: string;
  }) => api.post<{ success: boolean; document_id: number; message: string }>('/xrays/save-to-patient', payload),

  getPatientXrays: (patientId: number) =>
    api.get<PatientXrayItem[]>(`/xrays/patient/${patientId}`),

  getSliceUrl: (sessionId: string, plane: string, index: number) =>
    `/api/v1/xrays/slice?session_id=${encodeURIComponent(sessionId)}&plane=${plane}&index=${index}&t=${Date.now()}`,
};
