import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scan,
  Box,
  Download,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { xraysApi, PatientXrayItem } from '../../api/xrays';
import { Oral3DViewer } from '../../components/xrays/Oral3DViewer';
import { useAuth } from '../../context/AuthContext';
import { documentsApi } from '../../api/documents';

export default function PatientXrays() {
  const { user } = useAuth();
  const [activeModelUrl, setActiveModelUrl] = useState<string | null>(null);

  const { data: xrays = [], isLoading } = useQuery({
    queryKey: ['patientMyXrays', user?.patient_id],
    queryFn: () => (user?.patient_id ? xraysApi.getPatientXrays(user.patient_id) : Promise.resolve([])),
    enabled: !!user?.patient_id,
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                My 3D Dental X-Rays & Scans
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                Oral-3D
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive 3D dental reconstructions synthesized from your diagnostic panoramic X-rays.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded 3D Viewport */}
      <div className="bg-slate-900 p-3 rounded-3xl border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between px-2 text-xs text-slate-300">
          <span className="font-bold flex items-center gap-2">
            <Box className="w-4 h-4 text-teal-400" />
            <span>Interactive 3D Oral Cavity & Arch Model</span>
          </span>
          <span className="text-[10px] text-teal-400 font-mono">
            {activeModelUrl ? 'Patient Scan Loaded' : 'Dental Baseline Geometry'}
          </span>
        </div>

        <div className="h-[460px] w-full rounded-2xl overflow-hidden">
          <Oral3DViewer
            modelUrl={activeModelUrl || '/oral3d/models/test_teeth_std.glb'}
            activeShader="enamel"
            className="h-full"
          />
        </div>
      </div>

      {/* Scans List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-800">
          Diagnostic Radiographs & Scans on Record ({xrays.length})
        </h2>

        {isLoading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-2" />
            <span>Loading diagnostic scans...</span>
          </div>
        ) : xrays.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <Scan className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No scans on file</p>
            <p className="text-xs text-slate-400">When your dentist conducts a panoramic X-ray or 3D scan, it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {xrays.map((scan) => {
              const is3D = scan.original_file_name.endsWith('.glb') || scan.file_name.endsWith('.glb');
              return (
                <div
                  key={scan.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-teal-400 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-extrabold text-[10px] uppercase text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                        {is3D ? '3D Teeth Model' : scan.document_type.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 truncate" title={scan.original_file_name}>
                      {scan.original_file_name}
                    </h3>

                    {scan.notes?.metrics && (
                      <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[10px] space-y-0.5 text-slate-600 font-mono">
                        <div className="flex justify-between">
                          <span>Arch Width:</span>
                          <span className="font-bold text-slate-800">{scan.notes.metrics.arch_width_mm} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hard Volume:</span>
                          <span className="font-bold text-slate-800">{scan.notes.metrics.volume_cm3} cm³</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    {is3D && (
                      <button
                        onClick={() => {
                          const target = scan.file_path.startsWith('/')
                            ? scan.file_path
                            : `/api/v1/documents/${scan.id}/download`;
                          setActiveModelUrl(target);
                        }}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center gap-1 shadow-sm transition-colors text-xs"
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Inspect in 3D</span>
                      </button>
                    )}

                    <button
                      onClick={() => documentsApi.download(scan.id, scan.original_file_name)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1 transition-colors text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
