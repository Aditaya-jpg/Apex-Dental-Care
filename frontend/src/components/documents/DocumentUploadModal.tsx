import React, { useId, useState } from 'react';
import { Upload, ShieldCheck } from 'lucide-react';
import { documentsApi } from '../../api/documents';
import { useAuth } from '../../context/AuthContext';
import { TreatmentStage } from '../../types';
import { DISEASE_OPTIONS } from '../patients/PatientFormModal';
import Modal from '../common/Modal';

interface DocumentUploadModalProps {
    patientId?: number;
    patientName?: string;
    patientDiseaseCategories?: string[];
    defaultDocumentType?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const MEDIA_TYPE_OPTIONS: { group: string; value: string; label: string }[] = [
    { group: 'Diagnostic Imaging', value: 'xray', label: 'Periapical / Bitewing X-Ray' },
    { group: 'Diagnostic Imaging', value: 'opg', label: 'Panoramic Radiograph (OPG)' },
    { group: 'Diagnostic Imaging', value: 'cbct', label: 'Cone Beam CT (CBCT — 2D or Raw 3D up to 500MB)' },
    { group: 'Clinical Photography', value: 'intraoral_photo', label: 'Intraoral Photo' },
    { group: 'Clinical Photography', value: 'extraoral_photo', label: 'Extraoral Photo' },
    { group: 'Clinical Photography', value: 'iop_photo', label: 'IOP Photo (Intraoral Periapical / Operative)' },
    { group: 'Clinical Photography', value: 'profile_photo', label: 'Patient Profile Photo' },
    { group: 'Clinical Photography', value: 'surgery_photo', label: 'Surgical Procedure Photo' },
    { group: 'Clinical Photography', value: 'misc_photo', label: 'Miscellaneous Clinical Photo' },
    { group: 'Clinical Documents', value: 'patient_card', label: 'Patient Registration Card' },
    { group: 'Clinical Documents', value: 'parent_consent', label: 'Parent / Guardian Consent Form' },
    { group: 'Clinical Documents', value: 'lab_report', label: 'Lab Report / Histopathology' },
    { group: 'Clinical Documents', value: 'other', label: 'Other Clinical Document' },
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
    patientId,
    patientName,
    patientDiseaseCategories = [],
    defaultDocumentType = 'xray',
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { hasRole } = useAuth();
    const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

    const [docType, setDocType] = useState(defaultDocumentType);
    const [title, setTitle] = useState('');
    const [mediaDate, setMediaDate] = useState(new Date().toISOString().slice(0, 10));
    const [treatmentStage, setTreatmentStage] = useState<TreatmentStage>('initial_assessment');
    const [diseaseCategory, setDiseaseCategory] = useState<string>(
        patientDiseaseCategories[0] || ''
    );
    const [isSharedWithPatient, setIsSharedWithPatient] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const typeId = useId();
    const titleId = useId();
    const dateId = useId();
    const stageId = useId();
    const catId = useId();
    const fileId = useId();
    const notesId = useId();
    const shareId = useId();

    if (!isOpen) return null;

    const categoryChoices = Array.from(new Set([...patientDiseaseCategories, ...DISEASE_OPTIONS]));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please choose a file to upload.');
            return;
        }

        setIsUploading(true);
        setError(null);
        try {
            await documentsApi.upload({
                patientId: patientId || 1,
                documentType: docType,
                file,
                title: title.trim() || file.name,
                notes: notes.trim() || undefined,
                description: notes.trim() || undefined,
                diseaseCategory: diseaseCategory || undefined,
                treatmentStage,
                mediaDate,
                isSharedWithPatient: isDoctorOrAdmin ? isSharedWithPatient : false,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Upload Encrypted Imaging / Clinical Photography"
            subtitle={`Patient: ${patientName || `#${patientId || 1}`} • AES-256 Vault`}
            icon={<Upload className="w-4 h-4" aria-hidden="true" />}
            maxWidthClass="max-w-xl"
        >
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
                {error && (
                    <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor={typeId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Imaging / Photo / Document Type *
                        </label>
                        <select
                            id={typeId}
                            autoFocus
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        >
                            {['Diagnostic Imaging', 'Clinical Photography', 'Clinical Documents'].map((grp) => (
                                <optgroup key={grp} label={grp}>
                                    {MEDIA_TYPE_OPTIONS.filter((o) => o.group === grp).map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor={dateId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Media / Capture Date *
                        </label>
                        <input
                            id={dateId}
                            type="date"
                            required
                            value={mediaDate}
                            onChange={(e) => setMediaDate(e.target.value)}
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor={stageId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Treatment Stage
                        </label>
                        <select
                            id={stageId}
                            value={treatmentStage}
                            onChange={(e) => setTreatmentStage(e.target.value as TreatmentStage)}
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        >
                            <option value="initial_assessment">Initial Assessment</option>
                            <option value="pre_treatment">Pre-Treatment</option>
                            <option value="mid_treatment">Mid-Treatment</option>
                            <option value="surgery">Surgical Phase</option>
                            <option value="post_treatment">Post-Treatment</option>
                            <option value="follow_up">Follow-Up</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor={catId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Linked Disease Category
                        </label>
                        <select
                            id={catId}
                            value={diseaseCategory}
                            onChange={(e) => setDiseaseCategory(e.target.value)}
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        >
                            <option value="">General / Unspecified</option>
                            {categoryChoices.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor={titleId} className="block text-xs font-semibold text-slate-700 mb-1">
                        Label / Title
                    </label>
                    <input
                        id={titleId}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Pre-op OPG Panoramic — Mandibular Molar"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                </div>

                <div>
                    <label htmlFor={fileId} className="block text-xs font-semibold text-slate-700 mb-1">
                        Select File *
                    </label>
                    <input
                        id={fileId}
                        type="file"
                        required
                        accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.pdf,.dcm,.dicom,.nii,.nii.gz,.zip,.rar,.stl,.obj,.glb"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-slate-300 rounded-lg p-1"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                        Supports 2D images & PDFs (up to 25MB) AND raw 3D/CBCT formats (`.dcm`, `.nii`, `.nii.gz`, `.zip`, `.stl`, `.obj`, `.glb` up to 500MB).
                    </p>
                </div>

                <div>
                    <label htmlFor={notesId} className="block text-xs font-semibold text-slate-700 mb-1">
                        Clinical Description / Notes
                    </label>
                    <input
                        id={notesId}
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Periapical radiolucency noted at tooth #36 mesial root"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                </div>

                {isDoctorOrAdmin && (
                    <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-start gap-2.5">
                        <input
                            id={shareId}
                            type="checkbox"
                            checked={isSharedWithPatient}
                            onChange={(e) => setIsSharedWithPatient(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded text-teal-600"
                        />
                        <label htmlFor={shareId} className="text-xs text-teal-900 cursor-pointer">
                            <span className="font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                                Share with Patient in Portal
                            </span>
                            <span className="text-[11px] text-teal-700 block">
                                Unchecked by default (Private Clinical). Check only if the patient should view/download this file.
                            </span>
                        </label>
                    </div>
                )}

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
                        disabled={isUploading}
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isUploading ? 'Encrypting & Uploading...' : 'Upload to Vault'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DocumentUploadModal;
