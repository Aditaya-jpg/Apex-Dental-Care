import React, { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Pill,
  Plus,
  Search,
  Download,
  FileText,
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MessageCircle,
  Languages,
} from 'lucide-react';
import { prescriptionsApi } from '../api/prescriptions';
import { useAuth } from '../context/AuthContext';
import PrescriptionModal from '../components/prescriptions/PrescriptionModal';
import { LanguageCode, Prescription } from '../types';
import { buildWhatsAppShareUrl, formatDateIN, LANGUAGE_LABELS } from '../utils/formatters';

export default function Prescriptions() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canPrescribe = hasRole('admin', 'doctor', 'dentist');

  const [activeTab, setActiveTab] = useState<'prescriptions' | 'templates' | 'instructions' | 'formulary'>('prescriptions');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [instructionLang, setInstructionLang] = useState<LanguageCode>('en');
  const [expandedRxId, setExpandedRxId] = useState<number | null>(null);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const searchId = useId();
  const instLangId = useId();

  const { data: prescriptions = [], isLoading: isRxLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: () => prescriptionsApi.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['prescriptionTemplates'],
    queryFn: () => prescriptionsApi.getTemplates().catch(() => []),
  });

  const { data: instructionsLib = [] } = useQuery({
    queryKey: ['instructionsLibrary', instructionLang],
    queryFn: () => prescriptionsApi.getInstructionsLibrary(instructionLang).catch(() => []),
  });

  const { data: formulary = [], isLoading: isFormularyLoading } = useQuery({
    queryKey: ['medicineCatalog'],
    queryFn: prescriptionsApi.getCatalog,
  });

  const handleDownloadPdf = async (rx: Prescription, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(rx.id);
      await prescriptionsApi.downloadPdf(rx.id, rx.prescription_number);
    } catch {
      alert('Could not download prescription PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredRx = prescriptions.filter((rx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const rxNum = (rx.prescription_number || '').toLowerCase();
    const patient = (rx.patient_name || '').toLowerCase();
    const dentist = (rx.doctor_name || rx.dentist_name || '').toLowerCase();
    return rxNum.includes(q) || patient.includes(q) || dentist.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Prescriptions, Auto-Rx Templates & Care Instructions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue multilingual (EN / हिंदी / ਪੰਜਾਬੀ) prescriptions, generate Unicode PDFs, and share care instructions.
          </p>
        </div>
        {canPrescribe && (
          <button
            type="button"
            onClick={() => setIsRxModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl shadow-sm hover:bg-teal-700 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Write Prescription
          </button>
        )}
      </div>

      {/* Single-row scrollable tabs */}
      <div role="tablist" aria-label="Prescriptions sections" className="tab-scroll-strip border-b border-slate-200">
        {[
          { id: 'prescriptions', label: `Issued Prescriptions (${prescriptions.length})`, icon: FileText },
          { id: 'templates', label: `Auto-Rx Templates (${templates.length})`, icon: Pill },
          { id: 'instructions', label: 'Localized Care Instructions', icon: Languages },
          { id: 'formulary', label: `Medication Formulary (${formulary.length})`, icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Issued Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <label htmlFor={searchId} className="visually-hidden">
                Search prescriptions by number, patient, or doctor
              </label>
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                placeholder="Search by Rx #, patient or doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredRx.length} prescriptions
            </div>
          </div>

          {isRxLoading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent" />
              <p className="text-sm text-slate-500 mt-3 font-medium">Loading prescriptions...</p>
            </div>
          ) : filteredRx.length === 0 ? (
            <div className="bg-white py-16 text-center rounded-xl border border-slate-200">
              <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-base font-semibold text-slate-700">No prescriptions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRx.map((rx) => {
                const isExpanded = expandedRxId === rx.id;
                const itemsCount = rx.items?.length || 0;
                const waText = `PGI Dental Prescription ${rx.prescription_number}\nPatient: ${rx.patient_name || ''}\nMedicines: ${(rx.items || [])
                  .map((m) => `${m.medicine_name} (${m.dosage}, ${m.frequency}, ${m.duration})`)
                  .join('; ')}\nAdvice: ${rx.general_instructions || ''}`;

                return (
                  <div
                    key={rx.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => setExpandedRxId(isExpanded ? null : rx.id)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-teal-50 text-teal-600 rounded-xl mt-1">
                          <Pill className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {rx.prescription_number}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {itemsCount} {itemsCount === 1 ? 'Medication' : 'Medications'}
                            </span>
                            {rx.language && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 text-teal-700 border border-teal-200">
                                {LANGUAGE_LABELS[rx.language] || rx.language}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 mt-1.5">
                            <span className="flex items-center">
                              <UserIcon className="w-3.5 h-3.5 mr-1 text-slate-400" aria-hidden="true" />
                              Patient:{' '}
                              <Link
                                to={`/patients/${rx.patient_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="ml-1 text-teal-700 hover:underline font-medium"
                              >
                                {rx.patient_name || `Patient #${rx.patient_id}`}
                              </Link>
                            </span>
                            {(rx.doctor_name || rx.dentist_name) && (
                              <span>
                                Doctor:{' '}
                                <strong className="text-slate-700">
                                  {rx.doctor_name || rx.dentist_name}
                                </strong>
                              </span>
                            )}
                            <span className="flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" aria-hidden="true" />
                              Date: {formatDateIN(rx.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <a
                          href={buildWhatsAppShareUrl(undefined, waText)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                          Share via WhatsApp
                        </a>

                        <button
                          type="button"
                          onClick={(e) => handleDownloadPdf(rx, e)}
                          disabled={downloadingId === rx.id}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                          {downloadingId === rx.id ? 'Generating...' : 'Download PDF'}
                        </button>
                        <div className="text-slate-400 p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-5 h-5" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                          Prescribed Medication Details
                        </h2>
                        <div tabIndex={0} role="region" aria-label="Medication table" className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                <th scope="col" className="py-2.5 px-3">Medicine Name</th>
                                <th scope="col" className="py-2.5 px-3">Dosage</th>
                                <th scope="col" className="py-2.5 px-3">Frequency</th>
                                <th scope="col" className="py-2.5 px-3">Duration</th>
                                <th scope="col" className="py-2.5 px-3">Timing & Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rx.items?.map((item, i) => (
                                <tr key={item.id ?? i} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {item.medicine_name || item.drug_name}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">{item.dosage}</td>
                                  <td className="py-2.5 px-3 text-slate-700">{item.frequency}</td>
                                  <td className="py-2.5 px-3 text-slate-700">{item.duration}</td>
                                  <td className="py-2.5 px-3 text-slate-500 italic">
                                    {item.timing} {item.instructions ? `— ${item.instructions}` : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Auto-Rx Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.length === 0 ? (
            <div className="col-span-full bg-white p-10 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No Auto-Rx templates configured yet. Create one inside "Write Prescription".
            </div>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">{tpl.template_name}</h2>
                  <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-bold">
                    {tpl.items?.length || 0} meds
                  </span>
                </div>
                {tpl.diagnosis_summary && (
                  <p className="text-xs text-slate-600">{tpl.diagnosis_summary}</p>
                )}
                <ul className="text-[11px] text-slate-700 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {(tpl.items || []).map((it, idx) => (
                    <li key={idx}>
                      • <strong>{it.medicine_name || it.drug_name}</strong> ({it.dosage}, {it.frequency})
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Localized Care Instructions Library */}
      {activeTab === 'instructions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800">
              PGI Standardized Pre-Appointment & Post-Treatment Instructions
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor={instLangId} className="text-xs font-semibold text-slate-600">
                Preview Language:
              </label>
              <select
                id={instLangId}
                value={instructionLang}
                onChange={(e) => setInstructionLang(e.target.value as LanguageCode)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="en">English (EN)</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instructionsLib.length === 0 ? (
              <div className="col-span-full bg-white p-10 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No instruction templates loaded for this language yet.
              </div>
            ) : (
              instructionsLib.map((inst) => (
                <div
                  key={inst.key}
                  lang={inst.language}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{inst.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold uppercase">
                      {inst.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {inst.content}
                  </p>
                  <div className="pt-2 flex justify-end">
                    <a
                      href={buildWhatsAppShareUrl(undefined, `${inst.title}\n\n${inst.content}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Share via WhatsApp</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Formulary */}
      {activeTab === 'formulary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Approved Dental Pharmacy Formulary</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard dental analgesics, antibiotics, antiseptics, and local therapeutics.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">{formulary.length} drugs listed</span>
          </div>

          {isFormularyLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : (
            <div tabIndex={0} role="region" aria-label="Medication formulary table" className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4">Name / Generic</th>
                    <th scope="col" className="py-3 px-4">Form</th>
                    <th scope="col" className="py-3 px-4">Default Dosage</th>
                    <th scope="col" className="py-3 px-4">Standard Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {formulary.map((drug) => (
                    <tr key={drug.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{drug.name}</div>
                        {drug.generic_name && (
                          <div className="text-slate-500 font-mono text-[11px]">{drug.generic_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {drug.dosage_form}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{drug.default_dosage || '-'}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-sm truncate">{drug.instructions || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isRxModalOpen && (
        <PrescriptionModal
          isOpen={isRxModalOpen}
          onClose={() => setIsRxModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
          }}
        />
      )}
    </div>
  );
}
