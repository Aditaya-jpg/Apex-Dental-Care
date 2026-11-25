import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileText,
    Download,
    UserCheck,
    Calendar,
    Languages,
    Pill,
    HeartPulse,
    AlertCircle,
} from 'lucide-react';
import { patientPortalApi } from '../../api/patientPortal';
import { prescriptionsApi } from '../../api/prescriptions';
import { LanguageCode, PatientPortalPrescription } from '../../types';
import { formatDateIN, LANGUAGE_LABELS } from '../../utils/formatters';

export const PatientPrescriptions: React.FC = () => {
    const [languageFilter, setLanguageFilter] = useState<'all' | LanguageCode>('all');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['patient-portal-prescriptions'],
        queryFn: () => patientPortalApi.getPrescriptions(),
    });

    const prescriptions = data?.prescriptions ?? [];
    const careInstructions = data?.care_instructions ?? [];

    const filtered = prescriptions.filter((rx) =>
        languageFilter === 'all' ? true : rx.language === languageFilter
    );
    const filteredCare = careInstructions.filter((ci) =>
        languageFilter === 'all' ? true : ci.language === languageFilter
    );

    const handleDownloadPdf = async (rx: PatientPortalPrescription) => {
        setDownloadingId(rx.id);
        setDownloadError(null);
        try {
            await prescriptionsApi.downloadPdf(rx.id, rx.prescription_number);
        } catch (err: any) {
            setDownloadError(err?.message || 'Unable to download prescription PDF.');
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Prescriptions & Care Instructions
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Official medication schedules and post-procedure care in English, Hindi, or Punjabi.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Languages className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <label htmlFor="portal-rx-language-filter" className="visually-hidden">
                        Filter prescriptions by language
                    </label>
                    <select
                        id="portal-rx-language-filter"
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value as 'all' | LanguageCode)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="all">All Languages</option>
                        <option value="en">{LANGUAGE_LABELS.en}</option>
                        <option value="hi">{LANGUAGE_LABELS.hi}</option>
                        <option value="pa">{LANGUAGE_LABELS.pa}</option>
                    </select>
                </div>
            </div>

            {downloadError && (
                <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
                >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>{downloadError}</span>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
                >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>Unable to load prescriptions right now.</span>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 && filteredCare.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">
                        No prescriptions or instructions found
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Issued prescriptions and post-treatment instructions from your PGI doctor appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredCare.length > 0 && (
                        <section aria-labelledby="care-instructions-heading" className="space-y-3">
                            <h2
                                id="care-instructions-heading"
                                className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"
                            >
                                <HeartPulse className="w-4 h-4 text-teal-600" aria-hidden="true" />
                                <span>Doctor Care Instructions & Preventive Reminders</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredCare.map((ci) => (
                                    <article
                                        key={`care-${ci.id}`}
                                        className="bg-white rounded-2xl border border-teal-200/80 shadow-sm p-4 space-y-2"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-semibold text-sm text-slate-900">{ci.title}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                                    {LANGUAGE_LABELS[ci.language] || ci.language}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium capitalize bg-slate-100 text-slate-600">
                                                    {ci.category.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                            {ci.message}
                                        </p>
                                        <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                                {ci.scheduled_date
                                                    ? `Scheduled: ${formatDateIN(ci.scheduled_date)}`
                                                    : formatDateIN(ci.created_at)}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {filtered.length > 0 && (
                        <div className="space-y-5">
                            {filtered.map((rx) => {
                        const isInstructionOnly =
                            rx.record_type === 'instruction' || rx.record_type === 'preventive';
                        return (
                            <article
                                key={rx.id}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                            >
                                <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                                                {isInstructionOnly ? (
                                                    <HeartPulse className="w-3.5 h-3.5" aria-hidden="true" />
                                                ) : (
                                                    <Pill className="w-3.5 h-3.5" aria-hidden="true" />
                                                )}
                                                {rx.prescription_number}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700">
                                                {LANGUAGE_LABELS[rx.language] || rx.language}
                                            </span>
                                            {rx.record_type && (
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-sky-50 text-sky-700 border border-sky-200">
                                                    {rx.record_type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                                            <span className="inline-flex items-center gap-1.5">
                                                <UserCheck className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                                                {rx.doctor_display_name}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                                {formatDateIN(rx.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {!isInstructionOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPdf(rx)}
                                            disabled={downloadingId === rx.id}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 self-start sm:self-auto"
                                        >
                                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>{downloadingId === rx.id ? 'Generating PDF…' : 'Download PDF'}</span>
                                        </button>
                                    )}
                                </div>

                                <div className="p-5 space-y-4">
                                    {rx.diagnosis_summary && (
                                        <div>
                                            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                                Summary
                                            </h2>
                                            <p className="text-sm text-slate-800">{rx.diagnosis_summary}</p>
                                        </div>
                                    )}

                                    {rx.localized_summary && (
                                        <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-100">
                                            <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-1">
                                                Care Guidance ({LANGUAGE_LABELS[rx.language]})
                                            </h2>
                                            <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                                                {rx.localized_summary}
                                            </p>
                                        </div>
                                    )}

                                    {rx.items && rx.items.length > 0 && (
                                        <div>
                                            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                                Prescribed Medications
                                            </h2>
                                            <div
                                                className="overflow-x-auto rounded-xl border border-slate-200"
                                                tabIndex={0}
                                                role="region"
                                                aria-label="Medications table"
                                            >
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                                        <tr>
                                                            <th className="py-2.5 px-3 font-semibold">Medicine</th>
                                                            <th className="py-2.5 px-3 font-semibold">Dosage</th>
                                                            <th className="py-2.5 px-3 font-semibold">Frequency</th>
                                                            <th className="py-2.5 px-3 font-semibold">Duration</th>
                                                            <th className="py-2.5 px-3 font-semibold">Instructions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                                        {rx.items.map((item, idx) => (
                                                            <tr key={item.id ?? idx} className="hover:bg-slate-50/70">
                                                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                                                    {item.medicine_name}
                                                                </td>
                                                                <td className="py-2.5 px-3">{item.dosage}</td>
                                                                <td className="py-2.5 px-3">{item.frequency}</td>
                                                                <td className="py-2.5 px-3">
                                                                    {item.duration ||
                                                                        (item.duration_days
                                                                            ? `${item.duration_days} ${item.duration_days === 1 ? 'day' : 'days'}`
                                                                            : 'As advised')}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-600">
                                                                    {item.instructions || 'As directed'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {(rx.treatment_instructions || rx.general_instructions) && (
                                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-2">
                                            {rx.treatment_instructions && (
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                                        Post-Procedure Care
                                                    </span>
                                                    <p className="whitespace-pre-line">{rx.treatment_instructions}</p>
                                                </div>
                                            )}
                                            {rx.general_instructions && (
                                                <div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                                        Doctor Advice
                                                    </span>
                                                    <p className="whitespace-pre-line">{rx.general_instructions}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientPrescriptions;
