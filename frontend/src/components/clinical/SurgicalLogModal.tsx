import React, { useId, useState } from 'react';
import { Scissors } from 'lucide-react';
import { DocumentItem } from '../../types';
import { patientsApi } from '../../api/patients';
import Modal from '../common/Modal';

interface SurgicalLogModalProps {
  patientId: number;
  patientName: string;
  defaultSurgeon?: string;
  availableDocs: DocumentItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SurgicalLogModal: React.FC<SurgicalLogModalProps> = ({
  patientId,
  patientName,
  defaultSurgeon = '',
  availableDocs,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [surgeryDate, setSurgeryDate] = useState(new Date().toISOString().slice(0, 10));
  const [procedureName, setProcedureName] = useState('');
  const [toothNumbers, setToothNumbers] = useState('');
  const [surgeonName, setSurgeonName] = useState(defaultSurgeon);
  const [anesthesiaType, setAnesthesiaType] = useState('2% Lignocaine with 1:80,000 Adrenaline');
  const [operativeNotes, setOperativeNotes] = useState('');
  const [postOpInstructions, setPostOpInstructions] = useState(
    'Bite on gauze for 45 mins. Soft cold diet for 24h. Do not rinse vigorously.'
  );
  const [sutureRemovalDate, setSutureRemovalDate] = useState('');
  const [linkedDocIds, setLinkedDocIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateId = useId();
  const procId = useId();
  const teethId = useId();
  const surgeonId = useId();
  const anesthId = useId();
  const sutureId = useId();
  const opNotesId = useId();
  const postOpId = useId();

  if (!isOpen) return null;

  const toggleDoc = (id: number) => {
    setLinkedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureName.trim()) {
      setError('Surgical procedure name is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await patientsApi.createSurgicalLog(patientId, {
        patient_id: patientId,
        surgery_date: surgeryDate,
        procedure_name: procedureName.trim(),
        tooth_numbers: toothNumbers.trim() || undefined,
        surgeon_name: surgeonName.trim() || undefined,
        anesthesia_type: anesthesiaType.trim() || undefined,
        operative_notes: operativeNotes.trim() || undefined,
        post_op_instructions: postOpInstructions.trim() || undefined,
        suture_removal_date: sutureRemovalDate || undefined,
        linked_document_ids: linkedDocIds,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save surgical log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const candidatePhotos = availableDocs.filter(
    (d) =>
      d.document_type === 'surgery_photo' ||
      d.document_type.includes('photo') ||
      ['xray', 'opg', 'cbct'].includes(d.document_type)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Date-Wise Surgical Procedure"
      subtitle={`Patient: ${patientName} • Private Clinical Record`}
      icon={<Scissors className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={dateId} className="block text-xs font-semibold text-slate-700 mb-1">
              Surgery Date *
            </label>
            <input
              id={dateId}
              type="date"
              required
              autoFocus
              value={surgeryDate}
              onChange={(e) => setSurgeryDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={procId} className="block text-xs font-semibold text-slate-700 mb-1">
              Surgical Procedure *
            </label>
            <input
              id={procId}
              type="text"
              required
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              placeholder="e.g. Surgical Disimpaction — Mandibular Third Molar"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={teethId} className="block text-xs font-semibold text-slate-700 mb-1">
              Tooth Number(s)
            </label>
            <input
              id={teethId}
              type="text"
              value={toothNumbers}
              onChange={(e) => setToothNumbers(e.target.value)}
              placeholder="e.g. #38, #48"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label htmlFor={surgeonId} className="block text-xs font-semibold text-slate-700 mb-1">
              Operating Surgeon / Clinician
            </label>
            <input
              id={surgeonId}
              type="text"
              value={surgeonName}
              onChange={(e) => setSurgeonName(e.target.value)}
              placeholder="e.g. Dr. Mehta"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor={sutureId} className="block text-xs font-semibold text-slate-700 mb-1">
              Suture Removal Date
            </label>
            <input
              id={sutureId}
              type="date"
              value={sutureRemovalDate}
              onChange={(e) => setSutureRemovalDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor={anesthId} className="block text-xs font-semibold text-slate-700 mb-1">
            Anesthesia / Block Used
          </label>
          <input
            id={anesthId}
            type="text"
            value={anesthesiaType}
            onChange={(e) => setAnesthesiaType(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label htmlFor={opNotesId} className="block text-xs font-semibold text-slate-700 mb-1">
            Operative Notes (Flap, Bone Gutter, Sutures, Hemostasis)
          </label>
          <textarea
            id={opNotesId}
            rows={3}
            value={operativeNotes}
            onChange={(e) => setOperativeNotes(e.target.value)}
            placeholder="Describe incision, sectioning, irrigation, 3-0 silk sutures placed..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label htmlFor={postOpId} className="block text-xs font-semibold text-slate-700 mb-1">
            Post-Operative Care Instructions
          </label>
          <textarea
            id={postOpId}
            rows={2}
            value={postOpInstructions}
            onChange={(e) => setPostOpInstructions(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        {candidatePhotos.length > 0 && (
          <fieldset className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <legend className="text-xs font-bold text-slate-700 px-1">
              Link Surgery Photos / Scans from Encrypted Vault
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-36 overflow-y-auto">
              {candidatePhotos.map((d) => {
                const checked = linkedDocIds.includes(d.id);
                const cbId = `surg-doc-${d.id}`;
                return (
                  <label
                    key={d.id}
                    htmlFor={cbId}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border ${
                      checked
                        ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      id={cbId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDoc(d.id)}
                      className="w-3.5 h-3.5 rounded text-teal-600"
                    />
                    <span className="truncate">{d.title || d.original_file_name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Surgical Log'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SurgicalLogModal;
