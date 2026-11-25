import React, { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText,
  Upload,
  Search,
  Download,
  Image as ImageIcon,
  Eye,
  Lock,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { documentsApi } from '../api/documents';
import { useAuth } from '../context/AuthContext';
import DocumentUploadModal, { MEDIA_TYPE_OPTIONS } from '../components/documents/DocumentUploadModal';
import MediaLightboxModal from '../components/documents/MediaLightboxModal';
import { DocumentItem } from '../types';
import { formatDateIN, formatFileSize } from '../utils/formatters';

export default function Documents() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'date' | 'stage'>('none');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lightboxDoc, setLightboxDoc] = useState<DocumentItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const searchId = useId();
  const typeId = useId();
  const stageId = useId();
  const groupId = useId();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['allDocuments', typeFilter],
    queryFn: () => documentsApi.listAll(typeFilter !== 'all' ? typeFilter : undefined),
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, next }: { id: number; next: boolean }) =>
      documentsApi.toggleShare(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
    },
  });

  const handleDownload = async (doc: DocumentItem) => {
    try {
      setDownloadingId(doc.id);
      await documentsApi.download(doc.id, doc.original_file_name);
    } catch {
      alert('Could not download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (stageFilter !== 'all' && (doc.treatment_stage || 'initial_assessment') !== stageFilter) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (doc.title || doc.original_file_name || '').toLowerCase();
    const patient = (doc.patient_name || '').toLowerCase();
    const notes = (doc.description || doc.notes || '').toLowerCase();
    const cat = (doc.disease_category || '').toLowerCase();
    return name.includes(q) || patient.includes(q) || notes.includes(q) || cat.includes(q);
  });

  const groupedEntries: [string, DocumentItem[]][] = (() => {
    if (groupBy === 'none') return [['All Clinical Media', filteredDocs]];
    const map = new Map<string, DocumentItem[]>();
    filteredDocs.forEach((doc) => {
      const key =
        groupBy === 'date'
          ? formatDateIN(doc.media_date || doc.created_at)
          : (doc.treatment_stage || 'initial_assessment').replace(/_/g, ' ').toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    });
    return Array.from(map.entries());
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Encrypted Media Vault & Clinical Photography
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AES-256 encrypted storage for X-rays, OPG, raw CBCT, 6 clinical photo categories, cards & consent forms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl shadow-sm hover:bg-teal-700 transition self-start sm:self-auto"
        >
          <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
          Upload Media / Scan
        </button>
      </div>

      {/* Filter & Grouping Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <label htmlFor={searchId} className="visually-hidden">
              Search media by file name, patient, or disease category
            </label>
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              placeholder="Search file, patient, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor={typeId} className="text-xs font-medium text-slate-500">
              Type:
            </label>
            <select
              id={typeId}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="all">All Media & Docs</option>
              {MEDIA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor={stageId} className="text-xs font-medium text-slate-500">
              Stage:
            </label>
            <select
              id={stageId}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="all">All Stages</option>
              <option value="initial_assessment">Initial Assessment</option>
              <option value="pre_treatment">Pre-Treatment</option>
              <option value="mid_treatment">Mid-Treatment</option>
              <option value="surgery">Surgical Phase</option>
              <option value="post_treatment">Post-Treatment</option>
              <option value="follow_up">Follow-Up</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor={groupId} className="text-xs font-medium text-slate-500">
              Group:
            </label>
            <select
              id={groupId}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="none">Flat Grid</option>
              <option value="date">Date-Wise</option>
              <option value="stage">By Treatment Stage</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">{filteredDocs.length} files in vault</div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm text-slate-500 mt-3 font-medium">Loading encrypted vault records...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white py-16 text-center rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-base font-semibold text-slate-700">No documents found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([groupLabel, items]) => (
            <section key={groupLabel} className="space-y-3">
              {groupBy !== 'none' && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
                  {groupLabel} ({items.length})
                </h2>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((doc) => {
                  const isImage = doc.mime_type?.startsWith('image/');
                  const isShared = Boolean(doc.is_shared_with_patient);

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-teal-300 transition flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
                            {isImage || doc.document_type.includes('photo') ? (
                              <ImageIcon className="w-5 h-5" aria-hidden="true" />
                            ) : (
                              <FileText className="w-5 h-5" aria-hidden="true" />
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                              {doc.document_type.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isShared
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isShared ? (
                                <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <Lock className="w-3 h-3" aria-hidden="true" />
                              )}
                              {isShared ? 'Shared with Patient' : 'Private Clinical'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3
                            className="text-xs font-bold text-slate-900 truncate"
                            title={doc.title || doc.original_file_name}
                          >
                            {doc.title || doc.original_file_name}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {formatFileSize(doc.file_size_bytes || doc.file_size)} •{' '}
                            {formatDateIN(doc.media_date || doc.created_at)}
                          </p>
                          {doc.disease_category && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold">
                              {doc.disease_category}
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                          <span className="text-slate-400">Patient:</span>
                          <Link
                            to={`/patients/${doc.patient_id}`}
                            className="font-semibold text-teal-700 hover:underline truncate max-w-[150px]"
                          >
                            {doc.patient_name || `Patient #${doc.patient_id}`}
                          </Link>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLightboxDoc(doc)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            aria-label={`Download ${doc.original_file_name}`}
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        {isDoctorOrAdmin && (
                          <button
                            type="button"
                            onClick={() => shareMutation.mutate({ id: doc.id, next: !isShared })}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 transition ${
                              isShared
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <Share2 className="w-3 h-3" aria-hidden="true" />
                            <span>{isShared ? 'Make Private' : 'Share'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {isUploadModalOpen && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['allDocuments'] });
          }}
        />
      )}

      <MediaLightboxModal
        doc={lightboxDoc}
        isOpen={!!lightboxDoc}
        onClose={() => setLightboxDoc(null)}
      />
    </div>
  );
}
