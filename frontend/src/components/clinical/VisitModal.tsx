import React, { useId, useState } from 'react';
import { Stethoscope, Lock } from 'lucide-react';
import { clinicalApi } from '../../api/clinical';
import { useAuth } from '../../context/AuthContext';
import { SeverityLevel } from '../../types';
import Modal from '../common/Modal';
import { SEVERITY_META, getPainColorClass } from '../../utils/formatters';

interface VisitModalProps {
  patientId: number;
  patientName?: string;
  appointmentId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VisitModal: React.FC<VisitModalProps> = ({
  patientId,
  patientName,
  appointmentId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const dentistId = user?.doctor_id || user?.dentist_profile?.id || 1;

  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [bp, setBp] = useState('120/80');
  const [pulse, setPulse] = useState(72);
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Structured General Examination
  const [extraoralFindings, setExtraoralFindings] = useState('NAD / Facial symmetry normal');
  const [tmjStatus, setTmjStatus] = useState('Normal bilateral movement, no clicking');
  const [lymphNodes, setLymphNodes] = useState('Non-palpable / Non-tender');
  const [generalExamNotes, setGeneralExamNotes] = useState('');

  // Structured Intraoral Examination
  const [intraoralHardTissue, setIntraoralHardTissue] = useState('');
  const [intraoralSoftTissue, setIntraoralSoftTissue] = useState('Normal mucosa, gingiva & palate');
  const [occlusionStatus, setOcclusionStatus] = useState('Angle Class I / Stable');
  const [gumCondition, setGumCondition] = useState('Healthy');
  const [hygieneIndex, setHygieneIndex] = useState('Good');

  // Triage & Diagnosis
  const [painScale, setPainScale] = useState<number>(3);
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>('mild');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateId = useId();
  const bpId = useId();
  const pulseId = useId();
  const complaintId = useId();
  const extraoralId = useId();
  const tmjId = useId();
  const lymphId = useId();
  const genNotesId = useId();
  const hardId = useId();
  const softId = useId();
  const occlId = useId();
  const gumId = useId();
  const hygieneId = useId();
  const painId = useId();
  const sevId = useId();
  const diagId = useId();
  const clinNotesId = useId();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim() || !chiefComplaint.trim()) {
      setError('Chief complaint and clinical diagnosis are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await clinicalApi.createVisit({
        patient_id: patientId,
        dentist_id: dentistId,
        doctor_id: dentistId,
        appointment_id: appointmentId,
        visit_date: visitDate,
        vitals_blood_pressure: bp,
        vitals_pulse: Number(pulse),
        chief_complaint: chiefComplaint,
        extraoral_findings: extraoralFindings,
        tmj_status: tmjStatus,
        lymph_nodes: lymphNodes,
        general_exam_notes: generalExamNotes,
        intraoral_hard_tissue: intraoralHardTissue,
        intraoral_soft_tissue: intraoralSoftTissue,
        occlusion_status: occlusionStatus,
        oral_findings: `${intraoralHardTissue} | ${intraoralSoftTissue}`.trim(),
        gum_condition: gumCondition,
        hygiene_index: hygieneIndex,
        pain_scale: painScale,
        severity_level: severityLevel,
        diagnosis,
        clinical_notes: clinicalNotes,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record clinical examination');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Clinical Examination"
      subtitle={`Patient: ${patientName || `#${patientId}`} • Private Clinical Record`}
      icon={<Stethoscope className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
        <div className="px-3 py-2 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-semibold flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" aria-hidden="true" />
          <span>
            Private Clinical Record — General & Intraoral exams, pain triage, and clinical notes are restricted to PGI staff and never exposed in the Patient Portal.
          </span>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Vitals & Complaint */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={dateId} className="block text-xs font-semibold text-slate-700 mb-1">
              Visit Date *
            </label>
            <input
              id={dateId}
              type="date"
              required
              autoFocus
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor={bpId} className="block text-xs font-semibold text-slate-700 mb-1">
              Blood Pressure (mmHg)
            </label>
            <input
              id={bpId}
              type="text"
              placeholder="120/80"
              value={bp}
              onChange={(e) => setBp(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor={pulseId} className="block text-xs font-semibold text-slate-700 mb-1">
              Pulse Rate (bpm)
            </label>
            <input
              id={pulseId}
              type="number"
              value={pulse}
              onChange={(e) => setPulse(Number(e.target.value))}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor={complaintId} className="block text-xs font-semibold text-slate-700 mb-1">
            Chief Complaint *
          </label>
          <textarea
            id={complaintId}
            required
            rows={2}
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="e.g. Severe throbbing pain in upper right posterior region since 3 days..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        {/* Section 1: General Examination */}
        <fieldset className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <legend className="text-xs font-bold text-slate-800 px-1 uppercase tracking-wider">
            General & Extraoral Examination
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={extraoralId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Extraoral Findings
              </label>
              <input
                id={extraoralId}
                type="text"
                value={extraoralFindings}
                onChange={(e) => setExtraoralFindings(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label htmlFor={tmjId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                TMJ Status
              </label>
              <input
                id={tmjId}
                type="text"
                value={tmjStatus}
                onChange={(e) => setTmjStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label htmlFor={lymphId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Lymph Nodes
              </label>
              <input
                id={lymphId}
                type="text"
                value={lymphNodes}
                onChange={(e) => setLymphNodes(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
          <div>
            <label htmlFor={genNotesId} className="block text-[11px] font-semibold text-slate-600 mb-1">
              General Examination Notes
            </label>
            <textarea
              id={genNotesId}
              rows={2}
              value={generalExamNotes}
              onChange={(e) => setGeneralExamNotes(e.target.value)}
              placeholder="Gait, pallor, systemic observations, facial swelling/asymmetry..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            />
          </div>
        </fieldset>

        {/* Section 2: Intraoral Examination */}
        <fieldset className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <legend className="text-xs font-bold text-slate-800 px-1 uppercase tracking-wider">
            Intraoral Examination
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={hardId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hard Tissue Findings (Teeth / Caries / Restorations)
              </label>
              <textarea
                id={hardId}
                rows={2}
                value={intraoralHardTissue}
                onChange={(e) => setIntraoralHardTissue(e.target.value)}
                placeholder="Deep occlusal caries on #16, tender to vertical percussion..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label htmlFor={softId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Soft Tissue Findings (Mucosa / Tongue / Palate)
              </label>
              <textarea
                id={softId}
                rows={2}
                value={intraoralSoftTissue}
                onChange={(e) => setIntraoralSoftTissue(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={occlId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Occlusion Status
              </label>
              <input
                id={occlId}
                type="text"
                value={occlusionStatus}
                onChange={(e) => setOcclusionStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label htmlFor={gumId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Gingival / Periodontal Status
              </label>
              <select
                id={gumId}
                value={gumCondition}
                onChange={(e) => setGumCondition(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Healthy">Healthy Pink Stippled</option>
                <option value="Mild Gingivitis">Mild Marginal Gingivitis</option>
                <option value="Moderate Periodontitis">Moderate Periodontitis</option>
                <option value="Severe Periodontitis">Severe Periodontitis</option>
                <option value="Bleeding on Probing">Bleeding on Probing</option>
              </select>
            </div>
            <div>
              <label htmlFor={hygieneId} className="block text-[11px] font-semibold text-slate-600 mb-1">
                Oral Hygiene Index
              </label>
              <select
                id={hygieneId}
                value={hygieneIndex}
                onChange={(e) => setHygieneIndex(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Section 3: Pain Scale & Severity */}
        <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label htmlFor={painId} className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
              <span>Pain Scale (0–10)</span>
              <span className={`px-2 py-0.5 rounded font-mono border ${getPainColorClass(painScale)}`}>
                {painScale} / 10
              </span>
            </label>
            <input
              id={painId}
              type="range"
              min={0}
              max={10}
              step={1}
              value={painScale}
              style={{ '--progress': `${painScale * 10}%` } as React.CSSProperties}
              onChange={(e) => setPainScale(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0 (No Pain)</span>
              <span>5 (Moderate)</span>
              <span>10 (Worst Pain)</span>
            </div>
          </div>

          <div>
            <label htmlFor={sevId} className="block text-xs font-bold text-slate-800 mb-1.5">
              Clinical Severity Level ({SEVERITY_META[severityLevel]?.label})
            </label>
            <select
              id={sevId}
              value={severityLevel}
              onChange={(e) => setSeverityLevel(e.target.value as SeverityLevel)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="none">None / Routine</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical / Emergency</option>
            </select>
          </div>
        </div>

        {/* Diagnosis & Private Clinical Notes */}
        <div>
          <label htmlFor={diagId} className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Diagnosis *
          </label>
          <input
            id={diagId}
            type="text"
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute Irreversible Pulpitis — Tooth #16"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label htmlFor={clinNotesId} className="block text-xs font-semibold text-slate-700 mb-1">
            Private Clinical Notes & Operative Record
          </label>
          <textarea
            id={clinNotesId}
            rows={2}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Operative procedure notes, local anesthesia used, intracanal medicament..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Private Clinical Exam'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default VisitModal;
