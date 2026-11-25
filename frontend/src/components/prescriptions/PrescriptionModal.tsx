import React, { useState, useEffect, useId } from 'react';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Sparkles,
  Languages,
  BookmarkPlus,
} from 'lucide-react';
import { LanguageCode, MedicineCatalog, PrescriptionTemplate } from '../../types';
import { prescriptionsApi } from '../../api/prescriptions';
import { useAuth } from '../../context/AuthContext';
import Modal from '../common/Modal';

interface PrescriptionModalProps {
  patientId?: number;
  patientName?: string;
  defaultLanguage?: LanguageCode;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MedItemRow {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions?: string;
}

const LOCALIZED_RX_HINTS: Record<
  LanguageCode,
  { heading: string; timingMap: Record<string, string>; footerNote: string }
> = {
  en: {
    heading: 'English Clinical Instructions Preview',
    timingMap: {
      'After Food': 'Take after meals',
      'Before Food': 'Take 30 mins before meals',
      'With Food': 'Take during meals',
      'Before Bedtime': 'Take at bedtime',
      'As Needed (PRN)': 'Take only when needed for pain',
    },
    footerNote:
      'Complete the entire prescribed course. Rinse gently with warm saline water after meals.',
  },
  hi: {
    heading: 'हिंदी (Devanagari) रोगी निर्देश पूर्वावलोकन',
    timingMap: {
      'After Food': 'भोजन के बाद लें',
      'Before Food': 'भोजन से 30 मिनट पहले लें',
      'With Food': 'भोजन के साथ लें',
      'Before Bedtime': 'सोने से पहले लें',
      'As Needed (PRN)': 'दर्द होने पर आवश्यकतानुसार लें',
    },
    footerNote:
      'दवा का पूरा कोर्स समाप्त करें। भोजन के बाद गुनगुने नमक के पानी से कुल्ला करें।',
  },
  pa: {
    heading: 'ਪੰਜਾਬੀ (Gurmukhi) ਮਰੀਜ਼ ਹਦਾਇਤਾਂ ਝਲਕ',
    timingMap: {
      'After Food': 'ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਓ',
      'Before Food': 'ਖਾਣੇ ਤੋਂ 30 ਮਿੰਟ ਪਹਿਲਾਂ ਲਓ',
      'With Food': 'ਖਾਣੇ ਦੇ ਨਾਲ ਲਓ',
      'Before Bedtime': 'ਸੌਣ ਤੋਂ ਪਹਿਲਾਂ ਲਓ',
      'As Needed (PRN)': 'ਦਰਦ ਹੋਣ ਤੇ ਲੋੜ ਅਨੁਸਾਰ ਲਓ',
    },
    footerNote:
      'ਦਵਾਈ ਦਾ ਪੂਰਾ ਕੋਰਸ ਖਤਮ ਕਰੋ। ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਕੋਸੇ ਨਮਕ ਵਾਲੇ ਪਾਣੀ ਨਾਲ ਕੁਰਲੀ ਕਰੋ।',
  },
};

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  patientId,
  patientName,
  defaultLanguage = 'en',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const dentistId = user?.doctor_id || user?.dentist_profile?.id || 1;

  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [language, setLanguage] = useState<LanguageCode>(defaultLanguage);
  const [diagnosis, setDiagnosis] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState(
    LOCALIZED_RX_HINTS[defaultLanguage].footerNote
  );
  const [catalog, setCatalog] = useState<MedicineCatalog[]>([]);
  const [items, setItems] = useState<MedItemRow[]>([
    {
      medicine_name: 'Amoxicillin 500mg',
      dosage: '500mg',
      frequency: '1-0-1',
      duration: '5 days',
      timing: 'After Food',
      instructions: 'Take with full glass of water',
    },
  ]);

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateSelectId = useId();
  const langSelectId = useId();
  const diagId = useId();
  const genInstId = useId();
  const saveTplCheckId = useId();
  const tplNameId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setLanguage(defaultLanguage);
    prescriptionsApi
      .getCatalog()
      .then((res) => setCatalog(res || []))
      .catch(() => setCatalog([]));
    prescriptionsApi
      .getTemplates()
      .then((res) => setTemplates(res || []))
      .catch(() => setTemplates([]));
  }, [isOpen, defaultLanguage]);

  if (!isOpen) return null;

  const handleApplyTemplate = (templateIdStr: string) => {
    setSelectedTemplateId(templateIdStr);
    const tpl = templates.find((t) => String(t.id) === templateIdStr);
    if (!tpl) return;
    if (tpl.diagnosis_summary) setDiagnosis(tpl.diagnosis_summary);
    if (tpl.general_instructions) setGeneralInstructions(tpl.general_instructions);
    if (tpl.items && tpl.items.length > 0) {
      setItems(
        tpl.items.map((it) => ({
          medicine_name: it.medicine_name || it.drug_name || 'Medication',
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          timing: it.timing || 'After Food',
          instructions: it.instructions || '',
        }))
      );
    }
  };

  const handleLanguageChange = (nextLang: LanguageCode) => {
    setLanguage(nextLang);
    if (
      Object.values(LOCALIZED_RX_HINTS).some((h) => h.footerNote === generalInstructions) ||
      !generalInstructions.trim()
    ) {
      setGeneralInstructions(LOCALIZED_RX_HINTS[nextLang].footerNote);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        medicine_name: catalog[0]?.name || 'Paracetamol 500mg',
        dosage: catalog[0]?.default_dosage || '500mg',
        frequency: '1-0-1',
        duration: '5 days',
        timing: 'After Food',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleMedicineSelect = (index: number, medName: string) => {
    const selected = catalog.find((m) => m.name === medName);
    const updated = [...items];
    updated[index].medicine_name = medName;
    if (selected) {
      if (selected.default_dosage) updated[index].dosage = selected.default_dosage;
      if (selected.instructions) updated[index].instructions = selected.instructions;
    }
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Prescription must include at least one medication.');
      return;
    }
    if (saveAsTemplate && !newTemplateName.trim()) {
      setError('Please enter a name for the new Auto-Rx template.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const selectedTpl = templates.find((t) => String(t.id) === selectedTemplateId);
      const rx = await prescriptionsApi.create({
        patient_id: patientId || 1,
        dentist_id: dentistId,
        doctor_id: dentistId,
        language,
        template_name: selectedTpl?.template_name || (saveAsTemplate ? newTemplateName.trim() : undefined),
        diagnosis_summary: diagnosis,
        general_instructions: generalInstructions,
        items,
      });

      if (saveAsTemplate && newTemplateName.trim()) {
        await prescriptionsApi
          .createTemplate({
            template_name: newTemplateName.trim(),
            diagnosis_summary: diagnosis,
            general_instructions: generalInstructions,
            language,
            items,
          })
          .catch(() => {});
      }

      await prescriptionsApi.downloadPdf(rx.id, rx.prescription_number);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to issue prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const locPreview = LOCALIZED_RX_HINTS[language];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Digital Prescription (℞)"
      subtitle={`Patient: ${patientName || `#${patientId || 1}`} • Auto-Rx Templates & EN/HI/PA Unicode PDF`}
      icon={<FileSpreadsheet className="w-4 h-4" aria-hidden="true" />}
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Auto-Fill Template & Language Controls */}
        <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={templateSelectId} className="flex items-center gap-1.5 text-xs font-bold text-teal-900 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Auto-Fill from Template</span>
            </label>
            <select
              id={templateSelectId}
              autoFocus
              value={selectedTemplateId}
              onChange={(e) => handleApplyTemplate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-teal-300 rounded-lg bg-white"
            >
              <option value="">-- Custom / Select Standard PGI Rx Template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_name} ({t.items?.length || 0} meds)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={langSelectId} className="flex items-center gap-1.5 text-xs font-bold text-teal-900 mb-1">
              <Languages className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span>Prescription Language (EN / हिंदी / ਪੰਜਾਬੀ)</span>
            </label>
            <select
              id={langSelectId}
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
              className="w-full text-xs px-3 py-2 border border-teal-300 rounded-lg bg-white font-semibold"
            >
              <option value="en">English (EN)</option>
              <option value="hi">हिंदी (Hindi — Devanagari PDF)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi — Gurmukhi PDF)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={diagId} className="block text-xs font-semibold text-slate-700 mb-1">
            Diagnosis / Clinical Summary
          </label>
          <input
            id={diagId}
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute irreversible pulpitis, post-extraction analgesia"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        {/* Medicines List */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Prescribed Medications ({items.length})
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Medication
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const medId = `rx-med-${idx}`;
              const doseId = `rx-dose-${idx}`;
              const freqId = `rx-freq-${idx}`;
              const durId = `rx-dur-${idx}`;
              const timId = `rx-tim-${idx}`;
              const instId = `rx-inst-${idx}`;

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-5">
                      <label htmlFor={medId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Medicine Name
                      </label>
                      <input
                        id={medId}
                        type="text"
                        list={`med-list-${idx}`}
                        value={item.medicine_name}
                        onChange={(e) => handleMedicineSelect(idx, e.target.value)}
                        placeholder="Select or type medicine..."
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                      <datalist id={`med-list-${idx}`}>
                        {catalog.map((m) => (
                          <option key={m.id} value={m.name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor={doseId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Dosage
                      </label>
                      <input
                        id={doseId}
                        type="text"
                        value={item.dosage}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].dosage = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor={freqId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Frequency
                      </label>
                      <input
                        id={freqId}
                        type="text"
                        value={item.frequency}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].frequency = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor={durId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Duration
                      </label>
                      <input
                        id={durId}
                        type="text"
                        value={item.duration}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].duration = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end sm:pt-3">
                      <button
                        type="button"
                        aria-label={`Remove medication ${idx + 1}`}
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={timId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Timing
                      </label>
                      <select
                        id={timId}
                        value={item.timing}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].timing = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="After Food">After Food</option>
                        <option value="Before Food">Before Food</option>
                        <option value="With Food">With Food</option>
                        <option value="Before Bedtime">Before Bedtime</option>
                        <option value="As Needed (PRN)">As Needed (PRN)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={instId} className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Special Instructions
                      </label>
                      <input
                        id={instId}
                        type="text"
                        value={item.instructions || ''}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].instructions = e.target.value;
                          setItems(updated);
                        }}
                        placeholder="e.g. Rinse after use..."
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor={genInstId} className="block text-xs font-semibold text-slate-700 mb-1">
            General Patient Advice & Instructions
          </label>
          <textarea
            id={genInstId}
            rows={2}
            value={generalInstructions}
            onChange={(e) => setGeneralInstructions(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        {/* Live Localized Preview */}
        <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-teal-400">{locPreview.heading}</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {language.toUpperCase()}
            </span>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-300" lang={language}>
            {items.map((it, i) => (
              <li key={i}>
                • <strong>{it.medicine_name}</strong> ({it.dosage}, {it.frequency} × {it.duration}) —{' '}
                {locPreview.timingMap[it.timing] || it.timing}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-teal-200 italic pt-1 border-t border-slate-800" lang={language}>
            {generalInstructions}
          </p>
        </div>

        {/* Save as Template option */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label htmlFor={saveTplCheckId} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              id={saveTplCheckId}
              type="checkbox"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600"
            />
            <BookmarkPlus className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
            <span>Save these medications as a reusable Auto-Rx Template</span>
          </label>
          {saveAsTemplate && (
            <div>
              <label htmlFor={tplNameId} className="visually-hidden">
                New template name
              </label>
              <input
                id={tplNameId}
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name (e.g. Post-Impaction Protocol)"
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          )}
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
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isSubmitting ? 'Issuing & Generating PDF...' : 'Issue & Download PDF'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PrescriptionModal;
