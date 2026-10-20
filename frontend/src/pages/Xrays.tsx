import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Scan,
  Upload,
  Cpu,
  Layers,
  Sparkles,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
  User,
  Sliders,
  Maximize2,
  FileText,
  Info,
  ChevronRight,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Oral3DViewer, ShaderMode } from '../components/xrays/Oral3DViewer';
import { xraysApi, ReconstructResponse, XraySample, PatientXrayItem } from '../api/xrays';
import { patientsApi } from '../api/patients';
import { useAuth } from '../context/AuthContext';
import { Patient } from '../types';

export default function Xrays() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected Patient
  const initialPatientId = searchParams.get('patientId') ? Number(searchParams.get('patientId')) : null;
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(initialPatientId);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState<boolean>(false);

  // Scan & Reconstruction State
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'patient_records'>('presets');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('sample_1_adult_panoramic.png');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string>('/oral3d/samples/sample_1_adult_panoramic.png');
  const [isClaheContrast, setIsClaheContrast] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);

  // Parameters
  const [resolution, setResolution] = useState<'fast' | 'hd'>('fast');
  const [threshold, setThreshold] = useState<number>(-0.50);

  // Active 3D Model & Slices State
  const [currentModelUrl, setCurrentModelUrl] = useState<string>('/oral3d/models/test_teeth_std.glb');
  const [activeShader, setActiveShader] = useState<ShaderMode>('enamel');
  const [reconstructData, setReconstructData] = useState<ReconstructResponse | null>(null);
  const [isReconstructing, setIsReconstructing] = useState<boolean>(false);
  const [pipelineStep, setPipelineStep] = useState<string>('');
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);

  // Multi-Planar Reconstruction (MPR) Scrubbers
  const [axialIndex, setAxialIndex] = useState<number>(80);
  const [coronalIndex, setCoronalIndex] = useState<number>(128);
  const [sagittalIndex, setSagittalIndex] = useState<number>(144);
  const [axialImgUrl, setAxialImgUrl] = useState<string>('/oral3d/models/axial_preview.png');
  const [coronalImgUrl, setCoronalImgUrl] = useState<string>('/oral3d/models/coronal_preview.png');
  const [sagittalImgUrl, setSagittalImgUrl] = useState<string>('/oral3d/models/sagittal_preview.png');

  // Biometrics
  const [metrics, setMetrics] = useState({
    arch_width_mm: 64.5,
    arch_depth_mm: 51.2,
    arch_height_mm: 36.0,
    volume_cm3: 24.8,
    vertices: 29420,
    faces: 58836,
    latency_ms: 412,
  });

  // Save to Patient Modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>('Oral-3D Teeth Reconstruction');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Fetch Oral-3D Status
  const { data: engineStatus } = useQuery({
    queryKey: ['oral3dStatus'],
    queryFn: xraysApi.getStatus,
    refetchInterval: 15000,
  });

  // Fetch Clinical Samples
  const { data: samples = [] } = useQuery({
    queryKey: ['oral3dSamples'],
    queryFn: xraysApi.getSamples,
  });

  // Fetch Clinic Patients for Selector
  const { data: patientsData } = useQuery({
    queryKey: ['patientsList', patientSearch],
    queryFn: () => patientsApi.list(1, 40, patientSearch),
  });

  // Fetch Patient X-Rays if patient selected
  const { data: patientXrays = [] } = useQuery({
    queryKey: ['patientXrays', selectedPatientId],
    queryFn: () => (selectedPatientId ? xraysApi.getPatientXrays(selectedPatientId) : Promise.resolve([])),
    enabled: !!selectedPatientId,
  });

  const selectedPatient = patientsData?.items?.find((p) => p.id === selectedPatientId);

  // Handle Sample Select
  const handleSelectSample = (sample: XraySample) => {
    setSelectedSampleId(sample.id);
    setUploadedFile(null);
    setScanPreviewUrl(`/oral3d/samples/${sample.id}`);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSampleId('');
      const preview = URL.createObjectURL(file);
      setScanPreviewUrl(preview);
      setActiveTab('upload');
    }
  };

  // Execute Oral-3D Neural Reconstruction
  const handleReconstruct = async () => {
    setIsReconstructing(true);
    setPipelineProgress(15);
    setPipelineStep('Ingesting panoramic radiograph...');

    const timer1 = setTimeout(() => {
      setPipelineProgress(45);
      setPipelineStep('Oral-3D Deep Encoder: Synthesizing Multi-Planar Reconstructions (MPR)...');
    }, 700);

    const timer2 = setTimeout(() => {
      setPipelineProgress(75);
      setPipelineStep('Dental Arch Registration: 3D PriorShape Spatial Interpolation...');
    }, 1500);

    const timer3 = setTimeout(() => {
      setPipelineProgress(90);
      setPipelineStep('Marching Cubes: Extracting 3D Enamel & Alveolar Surface...');
    }, 2200);

    try {
      const formData = new FormData();
      formData.append('threshold', String(threshold));
      formData.append('resolution', resolution);

      if (uploadedFile) {
        formData.append('file', uploadedFile);
      } else if (selectedSampleId) {
        formData.append('sample_id', selectedSampleId);
      }

      if (selectedPatientId) {
        formData.append('patient_id', String(selectedPatientId));
      }

      const res = await xraysApi.reconstruct(formData);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setPipelineProgress(100);
      setPipelineStep('Complete! Loading 3D model into viewport...');

      setReconstructData(res);
      setMetrics({
        arch_width_mm: res.metrics.arch_width_mm,
        arch_depth_mm: res.metrics.arch_depth_mm,
        arch_height_mm: res.metrics.arch_height_mm,
        volume_cm3: res.metrics.volume_cm3,
        vertices: res.metrics.vertices,
        faces: res.metrics.faces,
        latency_ms: res.metrics.latency_ms || 400,
      });

      // Update 3D Model Viewport
      if (res.model_urls.glb) {
        setCurrentModelUrl(res.model_urls.glb);
      }

      // Update Initial Slices
      if (res.slices) {
        setAxialImgUrl(res.slices.axial);
        setCoronalImgUrl(res.slices.coronal);
        setSagittalImgUrl(res.slices.sagittal);
      }

      setTimeout(() => {
        setIsReconstructing(false);
      }, 600);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsReconstructing(false);
      alert(`Reconstruction failed: ${err.message || 'Check Oral-3D service status'}`);
    }
  };

  // Dynamic Slice Scrubber with live debounce
  const sliceDebounceRef = useRef<any>(null);
  const handleSliceChange = (plane: 'axial' | 'coronal' | 'sagittal', value: number) => {
    if (plane === 'axial') setAxialIndex(value);
    if (plane === 'coronal') setCoronalIndex(value);
    if (plane === 'sagittal') setSagittalIndex(value);

    if (!reconstructData?.session_id) return;

    if (sliceDebounceRef.current) clearTimeout(sliceDebounceRef.current);
    sliceDebounceRef.current = setTimeout(() => {
      const sliceUrl = xraysApi.getSliceUrl(reconstructData.session_id, plane, value);
      if (plane === 'axial') setAxialImgUrl(sliceUrl);
      if (plane === 'coronal') setCoronalImgUrl(sliceUrl);
      if (plane === 'sagittal') setSagittalImgUrl(sliceUrl);
    }, 60);
  };

  // Save to Patient Record Mutation
  const saveMutation = useMutation({
    mutationFn: (payload: {
      patient_id: number;
      session_id: string;
      title: string;
      notes: string;
      model_urls: Record<string, string>;
      metrics: Record<string, any>;
      input_scan_url?: string;
    }) => xraysApi.saveToPatient(payload),
    onSuccess: (data) => {
      setIsSaveModalOpen(false);
      setSaveSuccessMessage(data.message);
      queryClient.invalidateQueries({ queryKey: ['patientXrays', selectedPatientId] });
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      alert(`Could not save to record: ${err.message}`);
    },
  });

  const handleConfirmSave = () => {
    if (!selectedPatientId || !reconstructData) return;
    saveMutation.mutate({
      patient_id: selectedPatientId,
      session_id: reconstructData.session_id,
      title: saveTitle,
      notes: clinicalNotes,
      model_urls: reconstructData.model_urls,
      metrics: metrics,
      input_scan_url: reconstructData.input_scan_url,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 rounded-3xl border border-slate-800 text-white shadow-xl shadow-slate-950/40">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  X-rays & 3D Oral Diagnostic Studio
                </h1>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-teal-500/30 uppercase tracking-wider">
                  Oral-3D AI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumetric Multi-Planar Reconstruction (MPR) & 3D Teeth Surface Synthesis from 2D Panoramic Radiographs
              </p>
            </div>
          </div>
        </div>

        {/* Engine Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-inner">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                engineStatus?.status === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-medium text-slate-300">
              Oral-3D PyTorch:{' '}
              <strong className="text-white">
                {engineStatus?.status === 'online' ? `Online (${engineStatus.device?.toUpperCase() || 'CPU'})` : 'Standby Mode'}
              </strong>
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-[11px]">
            Grid: <span className="text-teal-400 font-bold">256×160×288</span>
          </div>
        </div>
      </div>

      {/* Patient Selector Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Clinic Patient (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search patient by name or code (e.g. John Doe)..."
                value={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name} (${selectedPatient.patient_code})` : patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setIsPatientDropdownOpen(true);
                  if (selectedPatient) setSelectedPatientId(null);
                }}
                onFocus={() => setIsPatientDropdownOpen(true)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Dropdown Options */}
            {isPatientDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId(null);
                    setPatientSearch('');
                    setIsPatientDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600 font-medium"
                >
                  Clear Selection (Independent Diagnostic Mode)
                </button>
                {patientsData?.items?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setPatientSearch('');
                      setIsPatientDropdownOpen(false);
                      setSearchParams({ patientId: String(p.id) });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-800 group-hover:text-teal-700">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.patient_code} • {p.gender} • {p.phone}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-900 mt-4">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                {selectedPatient.first_name[0]}
                {selectedPatient.last_name[0]}
              </div>
              <div>
                <p className="font-bold">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </p>
                <p className="text-[10px] text-teal-700 font-mono">
                  {selectedPatient.patient_code} • {patientXrays.length} X-rays on file
                </p>
              </div>
              <Link
                to={`/patients/${selectedPatient.id}`}
                className="ml-2 text-[10px] font-bold text-teal-700 hover:underline flex items-center gap-0.5"
              >
                View Profile <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Save to Patient Action Button */}
        {selectedPatient && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-700/20 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save 3D Scan to Patient File</span>
            </button>
          </div>
        )}
      </div>

      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main 3-Column Diagnostic Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (3.5 cols): Input Scan, Presets, and Reconstruct CTA */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Scan className="w-4 h-4 text-teal-600" />
                Input Dental Radiograph
              </h2>
              <span className="text-[10px] text-slate-400 font-mono uppercase">2D OPG</span>
            </div>

            {/* Ingestion Mode Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'presets' ? 'bg-white text-teal-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Clinical Presets
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'upload' ? 'bg-white text-teal-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Upload File
              </button>
              {selectedPatient && (
                <button
                  onClick={() => setActiveTab('patient_records')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    activeTab === 'patient_records' ? 'bg-white text-teal-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Patient Records ({patientXrays.length})
                </button>
              )}
            </div>

            {/* Tab 1: Clinical Presets */}
            {activeTab === 'presets' && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {samples.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSample(s)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      selectedSampleId === s.id
                        ? 'bg-teal-50/80 border-teal-500 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <img
                      src={`/oral3d/samples/${s.id}`}
                      alt={s.title}
                      className="w-16 h-8 object-cover rounded border border-slate-200 bg-black flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                      <p className="text-[10px] text-slate-400 truncate">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Upload Dropzone */}
            {activeTab === 'upload' && (
              <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-teal-50/30">
                <Upload className="w-7 h-7 text-teal-600 mb-2" />
                <span className="text-xs font-bold text-slate-800">Choose Panoramic Radiograph</span>
                <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, DICOM, or .MAT (160×576)</span>
                {uploadedFile && (
                  <span className="mt-2 text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                    Selected: {uploadedFile.name}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*,.mat"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}

            {/* Tab 3: Patient Records */}
            {activeTab === 'patient_records' && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {patientXrays.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">
                    No radiographs on file for this patient.
                  </p>
                ) : (
                  patientXrays.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedSampleId('');
                        setUploadedFile(null);
                        setScanPreviewUrl(`/api/v1/documents/${doc.id}/download`);
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 cursor-pointer flex items-center justify-between text-xs bg-slate-50/50 hover:bg-teal-50/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-bold text-slate-800 truncate">{doc.original_file_name}</p>
                        <p className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                        {doc.document_type}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2D Radiograph Preview Card */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Scan Preview & Enhancement
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsClaheContrast(!isClaheContrast)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      isClaheContrast
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    CLAHE Contrast
                  </button>
                  <button
                    onClick={() => setIsInverted(!isInverted)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      isInverted
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Invert
                  </button>
                </div>
              </div>

              <div className="relative bg-black rounded-xl overflow-hidden border border-slate-800 h-28 flex items-center justify-center">
                <img
                  src={scanPreviewUrl}
                  alt="Radiograph Preview"
                  className={`max-h-full max-w-full object-contain transition-all ${
                    isClaheContrast ? 'contrast-150 brightness-110 saturate-150' : ''
                  } ${isInverted ? 'invert' : ''}`}
                />
              </div>
            </div>

            {/* Reconstruction Parameters */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Resolution Mode</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    onClick={() => setResolution('fast')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      resolution === 'fast' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Fast WebGL (Step 3)
                  </button>
                  <button
                    onClick={() => setResolution('hd')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      resolution === 'hd' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Ultra HD (Step 2)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Bone / Enamel Isovalue</span>
                  <span className="font-mono text-teal-700 font-bold">{threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.80"
                  max="0.10"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Soft Tissue (-0.80)</span>
                  <span>Enamel Crown (+0.10)</span>
                </div>
              </div>
            </div>

            {/* Main Reconstruct Button */}
            <button
              onClick={handleReconstruct}
              disabled={isReconstructing}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isReconstructing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing 3D Teeth...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Reconstruct 3D Teeth</span>
                </>
              )}
            </button>

            {/* Animated Progress Tracker */}
            {isReconstructing && (
              <div className="space-y-1.5 p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs animate-fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold text-teal-900">
                  <span>{pipelineStep}</span>
                  <span>{pipelineProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-teal-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-300"
                    style={{ width: `${pipelineProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Column (5 cols): 3D Viewport */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-slate-900 p-2 rounded-3xl border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[480px]">
            <Oral3DViewer
              modelUrl={currentModelUrl}
              activeShader={activeShader}
              onShaderChange={(s) => setActiveShader(s)}
              onStatsLoaded={(st) =>
                setMetrics((prev) => ({ ...prev, vertices: st.vertices, faces: st.faces }))
              }
              className="flex-1"
            />
          </div>
        </div>

        {/* Right Column (3.5 cols): Multi-Planar Reconstruction (MPR) & 3D Exports */}
        <div className="lg:col-span-3 space-y-5">
          {/* Multi-Planar Reconstruction (MPR) Cross-Sections */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                Multi-Planar Slices (MPR)
              </h3>
              <span className="text-[10px] text-slate-400">Scrub Volume</span>
            </div>

            {/* 3 Orthogonal Planes: Axial, Coronal, Sagittal */}
            <div className="space-y-3">
              {/* Axial */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-teal-700">AXIAL PLANE (Z)</span>
                  <span className="font-mono text-slate-500 text-[10px]">Index: {axialIndex} / 160</span>
                </div>
                <div className="h-16 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <img
                    src={axialImgUrl}
                    alt="Axial Cross Section"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="159"
                  value={axialIndex}
                  onChange={(e) => handleSliceChange('axial', parseInt(e.target.value))}
                  className="w-full accent-teal-600 h-1 cursor-pointer"
                />
              </div>

              {/* Coronal */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-teal-700">CORONAL PLANE (Y)</span>
                  <span className="font-mono text-slate-500 text-[10px]">Index: {coronalIndex} / 256</span>
                </div>
                <div className="h-16 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <img
                    src={coronalImgUrl}
                    alt="Coronal Cross Section"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={coronalIndex}
                  onChange={(e) => handleSliceChange('coronal', parseInt(e.target.value))}
                  className="w-full accent-teal-600 h-1 cursor-pointer"
                />
              </div>

              {/* Sagittal */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-teal-700">SAGITTAL PLANE (X)</span>
                  <span className="font-mono text-slate-500 text-[10px]">Index: {sagittalIndex} / 288</span>
                </div>
                <div className="h-16 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <img
                    src={sagittalImgUrl}
                    alt="Sagittal Cross Section"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="287"
                  value={sagittalIndex}
                  onChange={(e) => handleSliceChange('sagittal', parseInt(e.target.value))}
                  className="w-full accent-teal-600 h-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Dental Biometrics Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center justify-between pb-2 border-b border-slate-100">
              <span>Dental Arch Biometrics</span>
              <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded">
                Estimated
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Arch Width</p>
                <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {metrics.arch_width_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Arch Depth</p>
                <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {metrics.arch_depth_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Arch Height</p>
                <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {metrics.arch_height_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Hard Volume</p>
                <p className="text-sm font-extrabold text-teal-700 mt-0.5">
                  {metrics.volume_cm3} <span className="text-[10px] font-normal text-slate-500">cm³</span>
                </p>
              </div>
            </div>
          </div>

          {/* 3D Model Download Center */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Export 3D Model</span>
              <span className="text-[10px] text-slate-400">CAD & Print</span>
            </h3>

            <div className="space-y-2">
              <a
                href={reconstructData?.model_urls?.stl || '/oral3d/models/test_teeth_std.glb'}
                download="Oral3D_Teeth_Structure.stl"
                className="flex items-center justify-between p-2.5 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-teal-900 rounded-xl text-xs font-bold transition-all shadow-sm group"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-teal-700 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download STL (3D Print)</span>
                </span>
                <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded font-mono">
                  STL
                </span>
              </a>

              <a
                href={reconstructData?.model_urls?.obj || '/oral3d/models/test_teeth_std.glb'}
                download="Oral3D_Teeth_Structure.obj"
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all group"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download OBJ (Exocad/CAD)</span>
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                  OBJ
                </span>
              </a>

              <a
                href={reconstructData?.model_urls?.glb || currentModelUrl}
                download="Oral3D_Teeth_Structure.glb"
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all group"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download GLB (Web/AR)</span>
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                  GLB
                </span>
              </a>

              <a
                href={reconstructData?.model_urls?.nii || '#'}
                download="Oral3D_Density_Volume.nii.gz"
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all group"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download NIfTI (.NII.GZ)</span>
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                  NII
                </span>
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Save to Patient Record Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Save 3D X-Ray to Patient Record</h3>
                  <p className="text-[11px] text-slate-500">
                    Patient: {selectedPatient?.first_name} {selectedPatient?.last_name} ({selectedPatient?.patient_code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Scan / Document Title</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Clinical Diagnostic Findings / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record crown alignment, dental arch dimensions, alveolar bone density notes..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Arch Width:</span>
                  <span className="font-bold text-slate-800">{metrics.arch_width_mm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Hard Volume:</span>
                  <span className="font-bold text-slate-800">{metrics.volume_cm3} cm³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Surface Mesh Complexity:</span>
                  <span className="font-bold text-slate-800">{metrics.vertices.toLocaleString()} verts</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saveMutation.isPending}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Confirm & Save to Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
