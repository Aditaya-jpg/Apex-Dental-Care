import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ClipboardList,
    Scan,
    Eye,
    Download,
    Calendar,
    Box,
    AlertCircle,
    CheckCircle2,
    FileText,
} from 'lucide-react';
import { patientPortalApi } from '../../api/patientPortal';
import { documentsApi } from '../../api/documents';
import { api } from '../../api/client';
import { DocumentItem, SharedNotice } from '../../types';
import { MediaLightboxModal, LightboxDocLike } from '../../components/documents/MediaLightboxModal';
import { Modal } from '../../components/common/Modal';
import { Oral3DViewer } from '../../components/xrays/Oral3DViewer';
import { formatDateIN, formatFileSize } from '../../utils/formatters';

export const PatientSharedRecords: React.FC = () => {
    const [lightboxDoc, setLightboxDoc] = useState<LightboxDocLike | null>(null);
    const [active3DDoc, setActive3DDoc] = useState<DocumentItem | null>(null);
    const [modelBlobUrl, setModelBlobUrl] = useState<string | null>(null);
    const [modelLoading, setModelLoading] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['patient-portal-shared-items'],
        queryFn: () => patientPortalApi.getSharedItems(),
    });

    const notices: SharedNotice[] = data?.notices ?? [];
    // Defense in depth: only render explicitly shared documents in Patient Portal
    const sharedDocs: DocumentItem[] = (data?.documents ?? []).filter(
        (doc) => doc.is_shared_with_patient !== false
    );

    useEffect(() => {
        let activeUrl: string | null = null;
        let cancelled = false;

        if (!active3DDoc) {
            setModelBlobUrl(null);
            setModelError(null);
            return;
        }

        setModelLoading(true);
        setModelError(null);
        api
            .downloadBlob(`/documents/${active3DDoc.id}/download`)
            .then((blob) => {
                if (cancelled) return;
                activeUrl = window.URL.createObjectURL(blob);
                setModelBlobUrl(activeUrl);
            })
            .catch((err: any) => {
                if (cancelled) return;
                setModelError(err?.message || 'Unable to load 3D oral model.');
            })
            .finally(() => {
                if (!cancelled) setModelLoading(false);
            });

        return () => {
            cancelled = true;
            if (activeUrl) {
                window.URL.revokeObjectURL(activeUrl);
            }
        };
    }, [active3DDoc]);

    const is3DModel = (doc: DocumentItem) => {
        const name = (doc.original_file_name || doc.file_name || '').toLowerCase();
        return name.endsWith('.glb') || name.endsWith('.stl') || name.endsWith('.obj');
    };

    const handleDownload = async (doc: DocumentItem) => {
        setDownloadingId(doc.id);
        setActionError(null);
        try {
            await documentsApi.download(doc.id, doc.original_file_name || doc.file_name || `record_${doc.id}`);
        } catch (err: any) {
            setActionError(err?.message || 'Failed to download shared record.');
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    Doctor Advisories & Shared Scans
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Tests or scans requested by your PGI doctor and diagnostic files explicitly shared with you.
                </p>
            </div>

            {actionError && (
                <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
                >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>{actionError}</span>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2"
                >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>Unable to load shared advisories and scans right now.</span>
                </div>
            )}

            {/* Section 1: Doctor Advisories ("Tests / Scans to Conduct & Bring") */}
            <section aria-labelledby="advisories-heading" className="space-y-3">
                <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-teal-600" aria-hidden="true" />
                    <h2 id="advisories-heading" className="text-lg font-bold text-slate-900">
                        Tests & Scans Requested for Your Next Visit
                    </h2>
                </div>

                {isLoading ? (
                    <div className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                ) : notices.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" aria-hidden="true" />
                        <span>No pending external tests or scan requests from your doctor right now.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {notices.map((notice) => {
                            const body = notice.description || notice.message;
                            const deadline = notice.target_date || notice.due_date;
                            return (
                                <article
                                    key={notice.id}
                                    className={`rounded-2xl border p-4 shadow-sm ${notice.is_resolved
                                        ? 'bg-slate-50 border-slate-200 opacity-85'
                                        : 'bg-amber-50/60 border-amber-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-white border border-slate-200 text-slate-700 mb-1.5">
                                                {notice.notice_type || 'Diagnostic Advisory'}
                                            </span>
                                            <h3 className="text-sm font-bold text-slate-900">{notice.title}</h3>
                                        </div>
                                        {notice.is_resolved ? (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                                Completed
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-200/80 text-amber-900">
                                                Action Needed
                                            </span>
                                        )}
                                    </div>

                                    {body && (
                                        <p className="text-xs text-slate-700 mt-2 leading-relaxed whitespace-pre-line">
                                            {body}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-2.5 border-t border-slate-200/70 text-[11px] text-slate-500">
                                        {deadline && (
                                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                                <Calendar className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                                                Bring by: {formatDateIN(deadline)}
                                            </span>
                                        )}
                                        <span>Posted: {formatDateIN(notice.created_at)}</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Section 2: Shared X-rays, Scans & 3D Oral Models */}
            <section aria-labelledby="shared-scans-heading" className="space-y-3">
                <div className="flex items-center gap-2">
                    <Scan className="w-5 h-5 text-teal-600" aria-hidden="true" />
                    <h2 id="shared-scans-heading" className="text-lg font-bold text-slate-900">
                        Shared X-Rays, Lab Results &amp; 3D Oral Views
                    </h2>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((idx) => (
                            <div key={idx} className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : sharedDocs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">No shared scans or reports yet</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Scans and files approved by your doctor for patient viewing will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sharedDocs.map((doc) => {
                            const filename = doc.original_file_name || doc.file_name || `Scan #${doc.id}`;
                            const model3D = is3DModel(doc);
                            return (
                                <article
                                    key={doc.id}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between gap-4 hover:border-teal-200 transition-colors"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-teal-50 text-teal-700 border border-teal-200">
                                                {doc.document_type.replace(/_/g, ' ')}
                                            </span>
                                            {model3D && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <Box className="w-3 h-3" aria-hidden="true" />
                                                    3D Model
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
                                            {doc.title || filename}
                                        </h3>

                                        <div className="text-xs text-slate-500 space-y-1">
                                            <p className="truncate">{filename}</p>
                                            <p>
                                                {formatDateIN(doc.media_date || doc.upload_date || doc.created_at)} ·{' '}
                                                {formatFileSize(doc.file_size_bytes ?? doc.file_size)}
                                            </p>
                                            {doc.disease_category && (
                                                <p className="text-teal-700 font-medium">Category: {doc.disease_category}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                        {model3D ? (
                                            <button
                                                type="button"
                                                onClick={() => setActive3DDoc(doc)}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                                            >
                                                <Box className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>View 3D</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setLightboxDoc(doc)}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span>Preview</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleDownload(doc)}
                                            disabled={downloadingId === doc.id}
                                            aria-label={`Download ${filename}`}
                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50"
                                        >
                                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>{downloadingId === doc.id ? '…' : 'Save'}</span>
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <MediaLightboxModal
                doc={lightboxDoc}
                isOpen={!!lightboxDoc}
                onClose={() => setLightboxDoc(null)}
            />

            <Modal
                isOpen={!!active3DDoc}
                onClose={() => setActive3DDoc(null)}
                title={active3DDoc?.title || active3DDoc?.original_file_name || '3D Oral View'}
                subtitle="Authenticated PGI Dental 3D Model Viewer"
                icon={<Box className="w-4 h-4" aria-hidden="true" />}
                maxWidthClass="max-w-4xl"
            >
                <div className="p-4 sm:p-5 space-y-4">
                    {modelLoading ? (
                        <div className="h-[420px] rounded-xl bg-slate-900 text-slate-200 flex items-center justify-center text-sm">
                            Decrypting 3D oral model…
                        </div>
                    ) : modelError ? (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                            {modelError}
                        </div>
                    ) : (
                        <div className="h-[420px] rounded-xl overflow-hidden border border-slate-200">
                            <Oral3DViewer modelUrl={modelBlobUrl} className="w-full h-full" />
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default PatientSharedRecords;
