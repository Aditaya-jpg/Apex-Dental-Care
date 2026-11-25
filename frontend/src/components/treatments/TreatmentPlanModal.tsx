import React, { useState, useEffect, useId } from 'react';
import { Plus, Trash2, Activity } from 'lucide-react';
import { ProcedureCatalog } from '../../types';
import { treatmentsApi } from '../../api/treatments';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

interface TreatmentPlanModalProps {
  patientId?: number;
  patientName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlanItemRow {
  procedure_name: string;
  tooth_number?: number;
  notes?: string;
}

export const TreatmentPlanModal: React.FC<TreatmentPlanModalProps> = ({
  patientId,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const dentistId = user?.doctor_id || user?.dentist_profile?.id || 1;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [catalog, setCatalog] = useState<ProcedureCatalog[]>([]);
  const [items, setItems] = useState<PlanItemRow[]>([
    { procedure_name: 'Comprehensive Oral Examination' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const notesId = useId();

  useEffect(() => {
    if (isOpen) {
      treatmentsApi
        .getCatalog()
        .then((res) => setCatalog(res || []))
        .catch(() => setCatalog([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      { procedure_name: catalog[0]?.name || 'Root Canal Therapy (RCT)' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleProcedureSelect = (index: number, procName: string) => {
    const updated = [...items];
    updated[index].procedure_name = procName;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the treatment plan.');
      return;
    }

    if (items.length === 0) {
      setError('Add at least one procedure to the plan.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await treatmentsApi.createPlan({
        patient_id: patientId || 1,
        dentist_id: dentistId,
        doctor_id: dentistId,
        title: title.trim(),
        notes,
        treatments: items.map((i) => ({
          procedure_name: i.procedure_name,
          tooth_number: i.tooth_number ? Number(i.tooth_number) : undefined,
          notes: i.notes,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create treatment plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Clinical Treatment Plan"
      subtitle={`Patient: ${patientName || `#${patientId || 1}`}`}
      icon={<Activity className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={titleId} className="block text-xs font-semibold text-slate-700 mb-1">
            Plan Title *
          </label>
          <input
            id={titleId}
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Comprehensive Molar Endodontics & Crown Restoration"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label htmlFor={notesId} className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Objectives / Sequencing Notes
          </label>
          <textarea
            id={notesId}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Phased treatment sequence, prognosis, clinical observations..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Planned Clinical Procedures ({items.length})
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Procedure
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const procId = `tp-proc-${idx}`;
              const toothId = `tp-tooth-${idx}`;
              const rowNotesId = `tp-notes-${idx}`;

              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  <div className="sm:col-span-5">
                    <label htmlFor={procId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Procedure
                    </label>
                    {catalog.length > 0 ? (
                      <select
                        id={procId}
                        value={item.procedure_name}
                        onChange={(e) => handleProcedureSelect(idx, e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        {catalog.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={procId}
                        type="text"
                        value={item.procedure_name}
                        onChange={(e) => handleProcedureSelect(idx, e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={toothId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Tooth # (FDI)
                    </label>
                    <input
                      id={toothId}
                      type="number"
                      placeholder="e.g. 16"
                      value={item.tooth_number || ''}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].tooth_number = e.target.value ? Number(e.target.value) : undefined;
                        setItems(updated);
                      }}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label htmlFor={rowNotesId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Clinical Notes
                    </label>
                    <input
                      id={rowNotesId}
                      type="text"
                      placeholder="Optional note"
                      value={item.notes || ''}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].notes = e.target.value;
                        setItems(updated);
                      }}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end sm:pt-3">
                    <button
                      type="button"
                      aria-label={`Remove procedure ${idx + 1}`}
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
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
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Plan...' : 'Save Treatment Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TreatmentPlanModal;
