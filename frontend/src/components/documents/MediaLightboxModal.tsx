import React, { useEffect, useState } from 'react';
import {
    Download,
    FileText,
    Scan,
    AlertCircle,
    Contrast,
    SunMoon,
    ShieldCheck,
    Calendar,
    Layers,
    Box,
} from 'lucide-react';
import Modal from '../common/Modal';
import { api } from '../../api/client';
import { documentsApi } from '../../api/documents';
import { Oral3DViewer } from '../xrays/Oral3DViewer';
import { formatDateIN, formatFileSize } from '../../utils/formatters';

export interface LightboxDocLike {
    id: number;
    original_file_name: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    file_size_bytes?: number;
    document_type?: string;
    xray_type?: string;
    title?: string;
    description?: string;
    notes?: string;
    disease_category?: string;
    treatment_stage?: string;
    media_date?: string;
    upload_date?: string;
    created_at?: string;
    sha256_checksum?: string;
    is_shared_with_patient?: boolean;
}

interface MediaLightboxModalProps {
    doc: LightboxDocLike | null;
    isOpen: boolean;
    onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
    doc,
    isOpen,
    onClose,
}) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [highContrast, setHighContrast] = useState(false);
    const [inverted, setInverted] = useState(false);

    const fileName = doc?.original_file_name || doc?.file_name || 'file';
    const ext = fileName.toLowerCase();
    const mime = (doc?.mime_type || '').toLowerCase();

    const is3D = ext.endsWith('.glb') || ext.endsWith('.stl') || ext.endsWith('.obj');
    const isPdf = mime.includes('pdf') || ext.endsWith('.pdf');
    const isImage =
        mime.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(ext);
    const isRawArchive = !is3D && !isPdf && !isImage;

    useEffect(() => {
        let activeUrl: string | null = null;
        let cancelled = false;

        if (!isOpen || !doc || isRawArchive) {
            setBlobUrl(null);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        setHighContrast(false);
        setInverted(false);

        api
            .downloadBlob(`/documents/${doc.id}/download`)
            .then((blob) => {
                if (cancelled) return;
                activeUrl = window.URL.createObjectURL(blob);
                setBlobUrl(activeUrl);
            })
            .catch((err: any) => {
                if (cancelled) return;
                setError(err?.message || 'Unable to load encrypted clinical file.');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
            if (activeUrl) {
                window.URL.revokeObjectURL(activeUrl);
            }
        };
    }, [isOpen, doc?.id, isRawArchive]);

    if (!doc || !isOpen) return null;

    const displayType = (doc.document_type || doc.xray_type || 'media').replace(/_/g, ' ').toUpperCase();
    const displayDate = doc.media_date || doc.upload_date || doc.created_at;
    const displaySize = doc.file_size_bytes || doc.file_size;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={doc.title || fileName}
            subtitle={`${displayType}${doc.disease_category ? ` • ${doc.disease_category}` : ''}`}
            icon={is3D ? <Box className="w-4 h-4" /> : <Scan className="w-4 h-4" />}
            maxWidthClass="max-w-4xl"
        >
            <div className="p-5 sm:p-6 space-y-4">
                {/* Metadata Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3 text-slate-600">
                        {displayDate && (
                            <span className="inline-flex items-center gap-1 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                                {formatDateIN(displayDate)}
                            </span>
                        )}
                        {doc.treatment_stage && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold capitalize">
                                <Layers className="w-3 h-3" aria-hidden="true" />
                                {doc.treatment_stage.replace(/_/g, ' ')}
                            </span>
                        )}
                        {displaySize ? (
                            <span className="font-mono text-[11px] text-slate-500">{formatFileSize(displaySize)}</span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            Encrypted Vault
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {isImage && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setHighContrast((v) => !v)}
                                    aria-pressed={highContrast}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${highContrast
                                        ? 'bg-teal-600 text-white border-teal-600'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                >
                                    <Contrast className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Enhance</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInverted((v) => !v)}
                                    aria-pressed={inverted}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${inverted
                                        ? 'bg-teal-600 text-white border-teal-600'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                >
                                    <SunMoon className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Invert</span>
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => documentsApi.download(doc.id, fileName)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Download</span>
                        </button>
                    </div>
                </div>

                {/* Viewer Area */}
                {isLoading ? (
                    <div className="h-80 bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-slate-300 text-xs gap-3">
                        <div className="w-9 h-9 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
                        <span>Decrypting & streaming clinical media...</span>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                ) : isRawArchive ? (
                    <div className="p-8 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center mx-auto">
                            <FileText className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Raw Volumetric / CBCT Archive</h2>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                {fileName} is stored encrypted in the PGI clinical vault for DICOM / NIfTI / 3D workstation review.
                            </p>
                        </div>
                        <div className="inline-flex flex-col sm:flex-row gap-3 text-xs bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 font-mono">
                            <span>Size: {formatFileSize(displaySize)}</span>
                            {doc.sha256_checksum && (
                                <span>SHA-256: {doc.sha256_checksum.slice(0, 16)}...</span>
                            )}
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => documentsApi.download(doc.id, fileName)}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" aria-hidden="true" />
                                <span>Download Raw Archive ({formatFileSize(displaySize)})</span>
                            </button>
                        </div>
                    </div>
                ) : is3D && blobUrl ? (
                    <div className="h-[440px] w-full rounded-2xl overflow-hidden border border-slate-800">
                        <Oral3DViewer modelUrl={blobUrl} activeShader="enamel" className="h-full" />
                    </div>
                ) : isPdf && blobUrl ? (
                    <div className="h-[520px] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                        <iframe title={`PDF Preview: ${fileName}`} src={blobUrl} className="w-full h-full border-0" />
                    </div>
                ) : isImage && blobUrl ? (
                    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3 flex items-center justify-center min-h-[320px] max-h-[62vh] overflow-hidden">
                        <img
                            src={blobUrl}
                            alt={doc.description || doc.title || fileName}
                            className={`max-h-[58vh] max-w-full object-contain rounded transition-all ${highContrast ? 'contrast-150 brightness-110' : ''
                                } ${inverted ? 'invert' : ''}`}
                        />
                    </div>
                ) : null}

                {(doc.description || doc.notes) && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                        <span className="font-semibold text-slate-500 uppercase text-[10px] block mb-0.5">
                            Clinical Notes / Description
                        </span>
                        <p>{doc.description || doc.notes}</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MediaLightboxModal;

