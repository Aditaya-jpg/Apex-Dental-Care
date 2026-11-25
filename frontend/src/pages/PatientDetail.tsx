import React, { useState, useEffect, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  Stethoscope,
  Download,
  Plus,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Scan,
  Box,
  ExternalLink,
  Sparkles,
  Edit,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Share2,
  Eye,
  Trash2,
  MessageCircle,
  BellRing,
  Scissors,
  Save,
  FileCheck,
  Languages,
} from 'lucide-react';
import { Oral3DViewer } from '../components/xrays/Oral3DViewer';
import {
  formatDateIN,
  formatFileSize,
  getPainColorClass,
  SEVERITY_META,
  LANGUAGE_LABELS,
  buildWhatsAppShareUrl,
  buildGoogleCalendarUrl,
} from '../utils/formatters';
import {
  Patient,
  DentalChartDetail,
  Visit,
  TreatmentPlan,
  Prescription,
  DocumentItem,
  FollowUp,
  Appointment,
  DateWiseXrayItem,
  SurgicalLog,
  SharedNotice,
  SeverityLevel,
  LanguageCode,
  Doctor,
  Student,
  TreatmentInstructionTemplate,
} from '../types';
import { patientsApi } from '../api/patients';
import { dentalChartApi } from '../api/dentalChart';
import { clinicalApi } from '../api/clinical';
import { treatmentsApi } from '../api/treatments';
import { prescriptionsApi } from '../api/prescriptions';
import { documentsApi } from '../api/documents';
import { followupsApi } from '../api/followups';
import { appointmentsApi } from '../api/appointments';
import { doctorsApi } from '../api/doctors';
import { studentsApi } from '../api/students';
import { api } from '../api/client';

import { FDIToothChart } from '../components/dental/FDIToothChart';
import { PerioChart } from '../components/dental/PerioChart';
import { ToothModal } from '../components/dental/ToothModal';
import { VisitModal } from '../components/clinical/VisitModal';
import { SurgicalLogModal } from '../components/clinical/SurgicalLogModal';
import { TreatmentPlanModal } from '../components/treatments/TreatmentPlanModal';
import { PrescriptionModal } from '../components/prescriptions/PrescriptionModal';
import { DocumentUploadModal, MEDIA_TYPE_OPTIONS } from '../components/documents/DocumentUploadModal';
import MediaLightboxModal, { LightboxDocLike } from '../components/documents/MediaLightboxModal';
import { FollowUpModal } from '../components/followups/FollowUpModal';
import { AppointmentModal } from '../components/appointments/AppointmentModal';
import { PatientFormModal } from '../components/patients/PatientFormModal';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const canEditClinical = hasRole('admin', 'doctor', 'dentist', 'student');
  const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [chartData, setChartData] = useState<DentalChartDetail | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [surgicalLogs, setSurgicalLogs] = useState<SurgicalLog[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [dateWiseXrays, setDateWiseXrays] = useState<DateWiseXrayItem[]>([]);
  const [sharedNotices, setSharedNotices] = useState<SharedNotice[]>([]);
  const [miscRecords, setMiscRecords] = useState<Record<string, string>>({});
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [doctorsPool, setDoctorsPool] = useState<Doctor[]>([]);
  const [studentsPool, setStudentsPool] = useState<Student[]>([]);

  const [activeTab, setActiveTab] = useState<
    | 'chart'
    | 'visits'
    | 'treatments'
    | 'prescriptions'
    | 'xrays'
    | 'documents'
    | 'misc'
    | 'appointments'
    | 'followups'
    | 'history'
    | 'timeline'
  >('chart');

  const [chartMode, setChartMode] = useState<'restorative' | 'perio'>('restorative');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [mediaGroupMode, setMediaGroupMode] = useState<'grid' | 'date' | 'stage'>('date');
  const [active3DModelBlobUrl, setActive3DModelBlobUrl] = useState<string | null>(null);

  // Triage controls state
  const [painScaleEdit, setPainScaleEdit] = useState<number>(0);
  const [severityEdit, setSeverityEdit] = useState<SeverityLevel>('none');
  const [isSavingTriage, setIsSavingTriage] = useState(false);

  // Quick Reassign state
  const [assignDoctorId, setAssignDoctorId] = useState<string>('');
  const [assignStudentId, setAssignStudentId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Instructions sub-section state
  const [instructionLang, setInstructionLang] = useState<LanguageCode>('en');
  const [instructionTemplates, setInstructionTemplates] = useState<TreatmentInstructionTemplate[]>([]);
  const [selectedInstKey, setSelectedInstKey] = useState<string>('');
  const [instMessage, setInstMessage] = useState('');
  const [instSentFeedback, setInstSentFeedback] = useState<string | null>(null);

  // Misc save feedback
  const [isSavingMisc, setIsSavingMisc] = useState(false);
  const [miscFeedback, setMiscFeedback] = useState<string | null>(null);

  // Advisory Modal state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeType, setNoticeType] = useState<'test_scan' | 'instruction' | 'general'>('test_scan');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeDueDate, setNoticeDueDate] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  // Card / Consent Preview & Upload Modal state
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardFileUpload, setCardFileUpload] = useState<File | null>(null);
  const [cardBlobUrl, setCardBlobUrl] = useState<string | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [consentFileUpload, setConsentFileUpload] = useState<File | null>(null);
  const [consentBlobUrl, setConsentBlobUrl] = useState<string | null>(null);
  const [consentGuardianName, setConsentGuardianName] = useState('');
  const [consentGuardianPhone, setConsentGuardianPhone] = useState('');
  const [consentStatusEdit, setConsentStatusEdit] = useState<'not_required' | 'pending' | 'signed'>('pending');

  // Lightbox & clinical modals
  const [lightboxDoc, setLightboxDoc] = useState<LightboxDocLike | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isSurgicalModalOpen, setIsSurgicalModalOpen] = useState(false);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [uploadDefaultType, setUploadDefaultType] = useState('xray');
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const painSliderId = useId();
  const sevSelectId = useId();
  const docReassignId = useId();
  const stuReassignId = useId();
  const instLangId = useId();
  const instTemplateId = useId();
  const instTextId = useId();
  const noticeTitleId = useId();
  const noticeTypeId = useId();
  const noticeDueId = useId();
  const noticeMsgId = useId();
  const cardInputId = useId();
  const consentGuardianId = useId();
  const consentPhoneId = useId();
  const consentStatId = useId();
  const consentInputId = useId();

  const loadPatientData = async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const [
        patRes,
        chartRes,
        visRes,
        planRes,
        rxRes,
        docRes,
        fuRes,
        apptRes,
        tlRes,
        xrayDwRes,
        surgRes,
        miscRes,
        noticesRes,
      ] = await Promise.all([
        patientsApi.getById(patientId),
        dentalChartApi.getChart(patientId).catch(() => null),
        clinicalApi.getPatientVisits(patientId).catch(() => []),
        treatmentsApi.listPlans({ patient_id: patientId }).catch(() => []),
        prescriptionsApi.list({ patient_id: patientId }).catch(() => []),
        documentsApi.getPatientDocuments(patientId).catch(() => []),
        followupsApi.list({ patient_id: patientId }).catch(() => []),
        appointmentsApi.list({ patient_id: patientId }).catch(() => []),
        patientsApi.getTimeline(patientId).catch(() => []),
        patientsApi.getDateWiseXrays(patientId).catch(() => []),
        patientsApi.getSurgicalLogs(patientId).catch(() => []),
        patientsApi.getMiscellaneous(patientId).catch(() => ({})),
        patientsApi.getSharedNotices(patientId).catch(() => []),
      ]);

      setPatient(patRes);
      setPainScaleEdit(patRes?.pain_scale ?? 0);
      setSeverityEdit((patRes?.severity_level as SeverityLevel) || 'none');
      setAssignDoctorId(patRes?.doctor_id ? String(patRes.doctor_id) : '');
      setAssignStudentId(patRes?.student_id ? String(patRes.student_id) : '');
      setConsentGuardianName(patRes?.parent_guardian_name || '');
      setConsentGuardianPhone(patRes?.parent_guardian_phone || '');
      setConsentStatusEdit(patRes?.parent_consent_status || 'not_required');
      setInstructionLang(patRes?.preferred_language || 'en');

      setChartData(chartRes);
      setVisits(visRes || []);
      setPlans(planRes || []);
      setPrescriptions(rxRes || []);
      setDocuments(docRes || []);
      setFollowups(fuRes || []);
      setAppointments(apptRes || []);
      setTimeline(tlRes || []);
      setDateWiseXrays(xrayDwRes || []);
      setSurgicalLogs(surgRes || []);
      setMiscRecords(miscRes && Object.keys(miscRes).length > 0 ? miscRes : patRes?.misc_records_json || {});
      setSharedNotices(
        noticesRes && noticesRes.length > 0 ? noticesRes : patRes?.patient_shared_notices_json || []
      );
    } catch {
      // Handled by global interceptor
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  useEffect(() => {
    if (isDoctorOrAdmin) {
      doctorsApi.list().then(setDoctorsPool).catch(() => {});
      studentsApi.list().then(setStudentsPool).catch(() => {});
    }
  }, [isDoctorOrAdmin]);

  useEffect(() => {
    prescriptionsApi
      .getInstructionsLibrary(instructionLang)
      .then((res) => {
        setInstructionTemplates(res || []);
        if (res && res.length > 0) {
          setSelectedInstKey(res[0].key);
          setInstMessage(res[0].content);
        }
      })
      .catch(() => setInstructionTemplates([]));
  }, [instructionLang]);

  // Authenticated blob loader for Card & Consent Modals
  useEffect(() => {
    let url: string | null = null;
    if (isCardModalOpen) {
      const cardDoc =
        (patient?.card_doc_id && documents.find((d) => d.id === patient.card_doc_id)) ||
        documents.find((d) => d.document_type === 'patient_card');
      if (cardDoc) {
        api
          .downloadBlob(`/documents/${cardDoc.id}/download`)
          .then((blob) => {
            url = URL.createObjectURL(blob);
            setCardBlobUrl(url);
          })
          .catch(() => setCardBlobUrl(null));
      } else {
        setCardBlobUrl(null);
      }
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isCardModalOpen, patient?.card_doc_id, documents]);

  useEffect(() => {
    let url: string | null = null;
    if (isConsentModalOpen) {
      const cDoc =
        (patient?.parent_consent_doc_id &&
          documents.find((d) => d.id === patient.parent_consent_doc_id)) ||
        documents.find((d) => d.document_type === 'parent_consent');
      if (cDoc) {
        api
          .downloadBlob(`/documents/${cDoc.id}/download`)
          .then((blob) => {
            url = URL.createObjectURL(blob);
            setConsentBlobUrl(url);
          })
          .catch(() => setConsentBlobUrl(null));
      } else {
        setConsentBlobUrl(null);
      }
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isConsentModalOpen, patient?.parent_consent_doc_id, documents]);

  // Revoke 3D blob URL if replaced/unmounted
  useEffect(() => {
    return () => {
      if (active3DModelBlobUrl && active3DModelBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(active3DModelBlobUrl);
      }
    };
  }, [active3DModelBlobUrl]);

  if (isLoading && !patient) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500">
        Loading complete PGI Dental EMR dossier...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-slate-500">
        Patient record not found or access restricted.
      </div>
    );
  }

  const displayName =
    patient.full_name ||
    patient.patient_name ||
    `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

  const handleSaveTriage = async () => {
    setIsSavingTriage(true);
    try {
      const updated = await patientsApi.updateSeverity(patientId, {
        pain_scale: painScaleEdit,
        severity_level: severityEdit,
      });
      setPatient((prev) => (prev ? { ...prev, ...updated, pain_scale: painScaleEdit, severity_level: severityEdit } : prev));
      setStatusFeedback('Pain scale & triage severity updated.');
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update severity');
    } finally {
      setIsSavingTriage(false);
    }
  };

  const handleQuickReassign = async (nextDoctorId: string, nextStudentId: string) => {
    setIsReassigning(true);
    try {
      await patientsApi.update(patientId, {
        doctor_id: nextDoctorId ? Number(nextDoctorId) : null,
        student_id: nextStudentId ? Number(nextStudentId) : null,
      });
      await loadPatientData();
      setStatusFeedback('Patient assignment updated.');
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign patient');
    } finally {
      setIsReassigning(false);
    }
  };

  const handleToggleShareDocument = async (doc: DocumentItem) => {
    if (!isDoctorOrAdmin) return;
    try {
      const next = !doc.is_shared_with_patient;
      await documentsApi.toggleShare(doc.id, next);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_shared_with_patient: next } : d))
      );
    } catch (err: any) {
      alert(err.message || 'Could not update sharing state');
    }
  };

  const handleLoad3DAuthenticated = async (docId: number) => {
    try {
      const blob = await api.downloadBlob(`/documents/${docId}/download`);
      const nextUrl = URL.createObjectURL(blob);
      setActive3DModelBlobUrl(nextUrl);
    } catch {
      alert('Failed to decrypt 3D scan model.');
    }
  };

  const handleCreateSharedNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;
    setIsSavingNotice(true);
    try {
      const created = await patientsApi.createSharedNotice(patientId, {
        title: noticeTitle.trim(),
        notice_type: noticeType,
        message: noticeMessage.trim(),
        due_date: noticeDueDate || undefined,
        language: patient.preferred_language || 'en',
      });
      setSharedNotices((prev) => [created, ...prev]);
      setIsNoticeModalOpen(false);
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeDueDate('');
    } catch (err: any) {
      alert(err.message || 'Failed to add patient advisory');
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string | number) => {
    try {
      await patientsApi.deleteSharedNotice(patientId, noticeId);
      setSharedNotices((prev) => prev.filter((n) => String(n.id) !== String(noticeId)));
    } catch (err: any) {
      alert(err.message || 'Failed to delete advisory');
    }
  };

  const handleSaveMiscellaneous = async () => {
    setIsSavingMisc(true);
    setMiscFeedback(null);
    try {
      await patientsApi.updateMiscellaneous(patientId, miscRecords);
      setMiscFeedback('Miscellaneous clinical records saved.');
      setTimeout(() => setMiscFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save miscellaneous records');
    } finally {
      setIsSavingMisc(false);
    }
  };

  const handleSendInstruction = async () => {
    if (!instMessage.trim()) return;
    const tpl = instructionTemplates.find((t) => t.key === selectedInstKey);
    try {
      await prescriptionsApi.sendInstruction({
        patient_id: patientId,
        template_key: selectedInstKey || undefined,
        title: tpl?.title || 'Clinical Care Instruction',
        content: instMessage,
        language: instructionLang,
        channel: 'portal',
      });
      setInstSentFeedback('Care instruction dispatched & saved to Patient Portal.');
      setTimeout(() => setInstSentFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to send instruction');
    }
  };

  const handleUploadCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFileUpload) return;
    const fd = new FormData();
    fd.append('file', cardFileUpload);
    if (patient.cr_number) fd.append('cr_number', patient.cr_number);
    await patientsApi.uploadCard(patientId, fd);
    setCardFileUpload(null);
    await loadPatientData();
  };

  const handleUploadConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    if (consentFileUpload) fd.append('file', consentFileUpload);
    fd.append('parent_guardian_name', consentGuardianName);
    fd.append('parent_guardian_phone', consentGuardianPhone);
    fd.append('parent_consent_status', consentStatusEdit);
    await patientsApi.uploadConsent(patientId, fd);
    setConsentFileUpload(null);
    await loadPatientData();
  };

  // Group date-wise X-rays under each disease category
  const xraysByCategory = (() => {
    const groups: Record<string, DateWiseXrayItem[]> = {};
    (patient.disease_categories || []).forEach((cat) => {
      groups[cat] = [];
    });

    const sourceXrays: DateWiseXrayItem[] =
      dateWiseXrays.length > 0
        ? dateWiseXrays
        : documents
            .filter((d) => ['xray', 'opg', 'cbct'].includes(d.document_type))
            .map((d) => ({
              id: d.id,
              patient_id: d.patient_id,
              upload_date: d.media_date || d.created_at,
              media_date: d.media_date || d.created_at,
              created_at: d.created_at,
              xray_type: d.document_type,
              document_type: d.document_type,
              treatment_stage: d.treatment_stage,
              title: d.title,
              description: d.description || d.notes,
              disease_category: d.disease_category,
              file_name: d.file_name,
              original_file_name: d.original_file_name,
              file_size: d.file_size_bytes || d.file_size,
              mime_type: d.mime_type,
              is_shared_with_patient: d.is_shared_with_patient,
              view_url: `/api/v1/documents/${d.id}/download`,
              download_url: `/api/v1/documents/${d.id}/download`,
            }));

    sourceXrays.forEach((x) => {
      const cat = x.disease_category || 'General / Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(x);
    });

    return groups;
  })();

  const xrayAnd3DDocs = documents.filter(
    (d) =>
      ['xray', 'opg', 'cbct'].includes(d.document_type) ||
      d.original_file_name.toLowerCase().endsWith('.glb')
  );

  const filteredMediaDocs = documents.filter((d) =>
    mediaTypeFilter === 'all' ? true : d.document_type === mediaTypeFilter
  );

  const groupedMediaEntries: [string, DocumentItem[]][] = (() => {
    if (mediaGroupMode === 'grid') return [['All Media Files', filteredMediaDocs]];
    const map = new Map<string, DocumentItem[]>();
    filteredMediaDocs.forEach((d) => {
      const k =
        mediaGroupMode === 'date'
          ? formatDateIN(d.media_date || d.created_at)
          : (d.treatment_stage || 'initial_assessment').replace(/_/g, ' ').toUpperCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    });
    return Array.from(map.entries());
  })();

  const miscBuckets = Array.from(
    new Set([...(patient.disease_categories || []), 'General'])
  );

  const tabs = [
    { id: 'chart', label: 'FDI Dental Chart', count: 32 },
    { id: 'visits', label: 'Examinations & Visits', count: visits.length },
    { id: 'treatments', label: 'Treatment Plans', count: plans.length + surgicalLogs.length },
    { id: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
    { id: 'xrays', label: 'X-rays (3D)', count: xrayAnd3DDocs.length },
    { id: 'documents', label: 'Clinical Media & Photos', count: documents.length },
    { id: 'misc', label: 'Miscellaneous', count: miscBuckets.length },
    { id: 'appointments', label: 'Appointments', count: appointments.length },
    { id: 'followups', label: 'Follow-ups', count: followups.length },
    { id: 'history', label: 'Medical/Dental History' },
    { id: 'timeline', label: 'Event Timeline', count: timeline.length },
  ];

  const consentStatus =
    patient.parent_consent_status ||
    (patient.parent_consent_required ? 'pending' : 'not_required');

  return (
    <div className="space-y-6">
      {statusFeedback && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. PRIORITY DEMOGRAPHICS HEADER CARD */}
      {/* =================================================================== */}
      <section aria-label="Patient Priority Demographics" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="flex items-start gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/patients')}
              aria-label="Back to patients directory"
              className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 flex items-center justify-center font-extrabold text-xl shadow-inner flex-shrink-0">
              {initials || 'PT'}
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {displayName}
                </h1>
                <span className="font-mono text-xs font-extrabold text-teal-800 bg-teal-50 border border-teal-300 px-2.5 py-0.5 rounded-md">
                  CR: {patient.cr_number || patient.patient_code}
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {patient.patient_code}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {patient.age ? `${patient.age} yrs` : ''} {patient.gender}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
                  <Languages className="w-3 h-3" aria-hidden="true" />
                  {LANGUAGE_LABELS[patient.preferred_language || 'en']}
                </span>
                {patient.special_case_flag && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    Special Case
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  {patient.phone}
                </span>
                {patient.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    {patient.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  DOB: {formatDateIN(patient.date_of_birth)}
                </span>
                {patient.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    {patient.address}
                  </span>
                )}
                {patient.blood_group && (
                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200 text-[10px]">
                    Blood: {patient.blood_group}
                  </span>
                )}
              </div>

              {(patient.case_keywords || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(patient.case_keywords || []).map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsCardModalOpen(true)}
              className="px-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <CreditCard className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
              <span>Patient Card</span>
            </button>

            <button
              type="button"
              onClick={() => setIsConsentModalOpen(true)}
              className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                consentStatus === 'signed'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : consentStatus === 'pending'
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {consentStatus === 'signed' ? (
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Consent: {consentStatus.replace(/_/g, ' ')}</span>
            </button>

            {canEditClinical && (
              <button
                type="button"
                onClick={() => setIsEditPatientOpen(true)}
                className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Edit Details</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsApptModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Book Appointment</span>
            </button>

            {canEditClinical && (
              <button
                type="button"
                onClick={() => setIsVisitModalOpen(true)}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Examination</span>
              </button>
            )}
          </div>
        </div>

        {/* Assignment Bar + Adjustable Pain Scale & Severity Triage */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Assigned Clinicians (Reassignable by Doctor/Admin) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label htmlFor={docReassignId} className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Attending Doctor
              </label>
              {isDoctorOrAdmin ? (
                <select
                  id={docReassignId}
                  disabled={isReassigning}
                  value={assignDoctorId}
                  onChange={(e) => {
                    const nextDoc = e.target.value;
                    setAssignDoctorId(nextDoc);
                    handleQuickReassign(nextDoc, assignStudentId);
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="">Unassigned / Pool</option>
                  {doctorsPool.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || d.doctor_name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs font-bold text-slate-800">
                  {patient.doctor_name || 'Faculty Pool'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={stuReassignId} className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Assigned Student Trainee
              </label>
              {isDoctorOrAdmin ? (
                <select
                  id={stuReassignId}
                  disabled={isReassigning}
                  value={assignStudentId}
                  onChange={(e) => {
                    const nextStu = e.target.value;
                    setAssignStudentId(nextStu);
                    handleQuickReassign(assignDoctorId, nextStu);
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="">None (Doctor Handles)</option>
                  {studentsPool.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.student_name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs font-bold text-slate-800">
                  {patient.student_name || user?.full_name || 'Assigned'}
                </p>
              )}
            </div>
          </div>

          {/* Interactive Pain Scale (0-10) & Severity Level */}
          <div className="lg:col-span-7 p-3 bg-teal-50/50 rounded-xl border border-teal-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-5">
              <label htmlFor={painSliderId} className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>Pain Scale (0–10)</span>
                <span className={`px-1.5 py-0.5 rounded font-mono border ${getPainColorClass(painScaleEdit)}`}>
                  {painScaleEdit}/10
                </span>
              </label>
              <input
                id={painSliderId}
                type="range"
                min={0}
                max={10}
                step={1}
                disabled={!canEditClinical}
                value={painScaleEdit}
                style={{ '--progress': `${painScaleEdit * 10}%` } as React.CSSProperties}
                onChange={(e) => setPainScaleEdit(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="sm:col-span-4">
              <label htmlFor={sevSelectId} className="block text-[11px] font-bold text-slate-700 mb-1">
                Severity Triage
              </label>
              <select
                id={sevSelectId}
                disabled={!canEditClinical}
                value={severityEdit}
                onChange={(e) => setSeverityEdit(e.target.value as SeverityLevel)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="none">None / Routine</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex justify-end sm:pt-4">
              {canEditClinical ? (
                <button
                  type="button"
                  disabled={isSavingTriage}
                  onClick={handleSaveTriage}
                  className="w-full px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSavingTriage ? 'Saving...' : 'Save Triage'}
                </button>
              ) : (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${SEVERITY_META[severityEdit]?.badgeClass}`}>
                  {SEVERITY_META[severityEdit]?.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Medical Allergy Alert Banner */}
        {patient.medical_history?.allergies &&
          patient.medical_history.allergies.toLowerCase() !== 'none' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>MEDICAL ALERT — ALLERGIES: {patient.medical_history.allergies}</span>
            </div>
          )}
      </section>

      {/* =================================================================== */}
      {/* 2. DISEASE CATEGORIES WITH DATE-WISE X-RAY HYPERLINKS + ADVISORIES */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Disease Categories Panel + Date-Wise X-Ray Hyperlinks */}
        <section
          aria-label="Disease Categories and Date-Wise Radiographs"
          className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Disease Categories & Date-Wise X-Ray Hyperlinks
              </h2>
              <p className="text-[11px] text-slate-500">
                Click any date-wise radiograph link under a category to open in the authenticated lightbox viewer.
              </p>
            </div>
            {canEditClinical && (
              <button
                type="button"
                onClick={() => {
                  setUploadDefaultType('xray');
                  setIsDocModalOpen(true);
                }}
                className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add X-Ray</span>
              </button>
            )}
          </div>

          {Object.keys(xraysByCategory).length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No disease categories or radiographs recorded yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(xraysByCategory).map(([category, items]) => (
                <div
                  key={category}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{category}</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                      {items.length} scans
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No radiographs linked yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((x) => {
                        const dateLabel = formatDateIN(x.media_date || x.upload_date || x.created_at);
                        const typeLabel = (x.xray_type || x.document_type || 'X-ray').toUpperCase();
                        const stageLabel = x.treatment_stage
                          ? ` (${x.treatment_stage.replace(/_/g, ' ')})`
                          : '';
                        return (
                          <li key={x.id}>
                            <button
                              type="button"
                              onClick={() => setLightboxDoc(x)}
                              className="text-left text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1.5 w-full"
                            >
                              <Scan className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate">
                                {dateLabel} — {x.title || typeLabel}
                                {stageLabel}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Doctor-to-Patient Advisories ("Tests / Scans to Conduct & Bring") */}
        <section
          aria-label="Doctor-to-Patient Advisories"
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-teal-600" aria-hidden="true" />
                <span>Patient Advisories: Tests & Scans to Conduct</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Explicitly visible in Patient Portal (without exposing private notes).
              </p>
            </div>
            {isDoctorOrAdmin && (
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(true)}
                className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Advisory</span>
              </button>
            )}
          </div>

          {sharedNotices.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 text-center">
              No patient-visible test/scan advisories issued yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sharedNotices.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 text-xs flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-teal-950">{n.title}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white text-teal-800 border border-teal-200 text-[10px] font-bold uppercase">
                        {n.notice_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-slate-700">{n.message}</p>
                    {n.due_date && (
                      <p className="text-[10px] text-slate-500">
                        Bring / Complete by: <strong>{formatDateIN(n.due_date)}</strong>
                      </p>
                    )}
                  </div>
                  {isDoctorOrAdmin && (
                    <button
                      type="button"
                      aria-label={`Remove advisory ${n.title}`}
                      onClick={() => handleDeleteNotice(n.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* =================================================================== */}
      {/* 3. SINGLE-ROW HORIZONTALLY SCROLLABLE EMR MODULE TABS */}
      {/* =================================================================== */}
      <div
        role="tablist"
        aria-label="Patient EMR sections"
        className="tab-scroll-strip border-b border-slate-200 gap-1 text-xs font-semibold"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={(e) => {
              setActiveTab(tab.id as any);
              e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }}
            className={`py-3 px-4 rounded-t-xl transition-all whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
              activeTab === tab.id
                ? 'bg-white border-teal-600 text-teal-800 font-bold shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: FDI RESTORATIVE + PERIO CHART */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMode('restorative')}
                className={`px-4 py-2 rounded-lg transition ${
                  chartMode === 'restorative'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Restorative Chart (FDI)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('perio')}
                className={`px-4 py-2 rounded-lg transition ${
                  chartMode === 'perio'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Perio Chart (6-Site)
              </button>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              Private Clinical Chart (Not exposed in Patient Portal)
            </span>
          </div>

          {chartMode === 'restorative' ? (
            <div className="space-y-4">
              <FDIToothChart
                teeth={chartData?.teeth || {}}
                selectedTooth={selectedTooth}
                onSelectTooth={(tNum) => setSelectedTooth(tNum)}
              />
              <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-2xl flex items-center justify-between text-xs text-teal-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true" />
                  <span>
                    Click any tooth on the upper or lower arch to view history or update conditions (caries, filled, crown, RCT, missing).
                  </span>
                </div>
                {selectedTooth && (
                  <span className="font-bold text-teal-700 bg-white px-2 py-1 rounded-md border border-teal-200">
                    Selected: Tooth #{selectedTooth}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <PerioChart patientId={patientId} canEdit={canEditClinical} />
          )}
        </div>
      )}

      {/* TAB 2: CLINICAL EXAMINATIONS & VISITS */}
      {activeTab === 'visits' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              Clinical Visits, General & Intraoral Examinations
            </h2>
            {canEditClinical && (
              <button
                type="button"
                onClick={() => setIsVisitModalOpen(true)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Record New Examination
              </button>
            )}
          </div>

          {visits.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No clinical visits recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {visits.map((v) => {
                const vSev = (v.severity_level as SeverityLevel) || 'none';
                return (
                  <div
                    key={v.id}
                    className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                            Visit: {formatDateIN(v.visit_date)}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                            <Lock className="w-3 h-3" aria-hidden="true" /> Private Clinical Record
                          </span>
                          {v.pain_scale !== undefined && (
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${getPainColorClass(v.pain_scale)}`}>
                              Pain: {v.pain_scale}/10
                            </span>
                          )}
                          {v.severity_level && (
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SEVERITY_META[vSev]?.badgeClass}`}>
                              {SEVERITY_META[vSev]?.label}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                          Diagnosis: {v.diagnosis || 'General Examination'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Clinician: {v.doctor_name || v.dentist_name || 'Attending Clinician'}
                        </p>
                      </div>

                      <div className="flex gap-4 text-xs font-medium text-slate-600">
                        {v.vitals_blood_pressure && (
                          <span>
                            BP: <b>{v.vitals_blood_pressure}</b>
                          </span>
                        )}
                        {v.vitals_pulse && (
                          <span>
                            Pulse: <b>{v.vitals_pulse} bpm</b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          General Examination
                        </p>
                        <p><strong>Chief Complaint:</strong> {v.chief_complaint || 'None'}</p>
                        <p><strong>Extraoral:</strong> {v.extraoral_findings || 'Normal'}</p>
                        <p><strong>TMJ:</strong> {v.tmj_status || 'Normal'}</p>
                        <p><strong>Lymph Nodes:</strong> {v.lymph_nodes || 'Non-palpable'}</p>
                        {v.general_exam_notes && <p className="italic text-slate-600">{v.general_exam_notes}</p>}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          Intraoral Examination
                        </p>
                        <p><strong>Hard Tissue:</strong> {v.intraoral_hard_tissue || v.oral_findings || 'Normal'}</p>
                        <p><strong>Soft Tissue:</strong> {v.intraoral_soft_tissue || 'Normal mucosa'}</p>
                        <p><strong>Occlusion:</strong> {v.occlusion_status || 'Stable'}</p>
                        <p><strong>Gingiva / Hygiene:</strong> {v.gum_condition || 'Healthy'} • {v.hygiene_index || 'Good'}</p>
                      </div>
                    </div>

                    {v.clinical_notes && (
                      <div className="pt-2 border-t border-slate-100 text-xs">
                        <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                          Clinical Notes & Operative Record
                        </p>
                        <p className="text-slate-700 mt-0.5 italic">{v.clinical_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TREATMENT PLANS & DATE-WISE SURGICAL LOGS */}
      {activeTab === 'treatments' && (
        <div className="space-y-6">
          {/* Treatment Plans Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-800">Comprehensive Treatment Plans</h2>
              {canEditClinical && (
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> New Treatment Plan
                </button>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No treatment plans active for this patient.
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((p) => {
                  const itemsList = p.items || p.treatments || [];
                  return (
                    <div
                      key={p.id}
                      className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                              {p.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Doctor: {p.doctor_name || p.dentist_name || 'Attending Doctor'} • Created{' '}
                            {formatDateIN(p.created_at)}
                          </p>
                        </div>
                      </div>

                      <div tabIndex={0} role="region" aria-label="Plan procedures table" className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th scope="col" className="py-2 px-4">Procedure</th>
                              <th scope="col" className="py-2 px-4">Tooth #</th>
                              <th scope="col" className="py-2 px-4">Status</th>
                              <th scope="col" className="py-2 px-4">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {itemsList.map((t) => (
                              <tr key={t.id}>
                                <td className="py-2.5 px-4 font-semibold text-slate-800">
                                  {t.procedure_name}
                                </td>
                                <td className="py-2.5 px-4">
                                  {t.tooth_number ? `Tooth #${t.tooth_number}` : 'Full Arch / General'}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      t.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : t.status === 'in_progress'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-500">{t.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date-Wise Surgical Treatment Log Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-teal-600" aria-hidden="true" />
                  <span>Date-Wise Surgical Treatment Log</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Operative log with anesthesia, suture dates, and encrypted surgery photos.
                </p>
              </div>
              {canEditClinical && (
                <button
                  type="button"
                  onClick={() => setIsSurgicalModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Log Surgical Procedure
                </button>
              )}
            </div>

            {surgicalLogs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No surgical procedures logged for this patient.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div tabIndex={0} role="region" aria-label="Surgical treatment logs table" className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th scope="col" className="py-3 px-4">Date</th>
                        <th scope="col" className="py-3 px-4">Procedure & Teeth</th>
                        <th scope="col" className="py-3 px-4">Surgeon / Anesthesia</th>
                        <th scope="col" className="py-3 px-4">Operative Notes & Sutures</th>
                        <th scope="col" className="py-3 px-4">Linked Surgery Photos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {surgicalLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-teal-800">
                            {formatDateIN(log.surgery_date)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{log.procedure_name}</div>
                            {log.tooth_numbers && (
                              <div className="text-[11px] font-mono text-slate-500">
                                Teeth: {log.tooth_numbers}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{log.surgeon_name || 'PGI Surgical Team'}</div>
                            {log.anesthesia_type && (
                              <div className="text-[11px] text-slate-500">{log.anesthesia_type}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-slate-700">{log.operative_notes || '-'}</p>
                            {log.suture_removal_date && (
                              <p className="text-[10px] font-semibold text-amber-800 mt-1">
                                Suture Removal: {formatDateIN(log.suture_removal_date)}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {(log.linked_document_ids || []).length === 0 ? (
                                <span className="text-slate-400 italic">None</span>
                              ) : (
                                (log.linked_document_ids || []).map((docId) => {
                                  const linkedDoc = documents.find((d) => d.id === docId);
                                  if (!linkedDoc) return null;
                                  return (
                                    <button
                                      key={docId}
                                      type="button"
                                      onClick={() => setLightboxDoc(linkedDoc)}
                                      className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-semibold inline-flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" aria-hidden="true" />
                                      <span>{linkedDoc.title || linkedDoc.original_file_name}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PRESCRIPTIONS & LOCALIZED TREATMENT INSTRUCTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-800">Issued Prescriptions (℞)</h2>
              {isDoctorOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsRxModalOpen(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Write Prescription
                </button>
              )}
            </div>

            {prescriptions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                No prescriptions issued for this patient.
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => {
                  const waText = `PGI Dental Prescription (${rx.prescription_number}) for ${displayName}:\n${(rx.items || [])
                    .map((it) => `• ${it.medicine_name} ${it.dosage} (${it.frequency}, ${it.duration})`)
                    .join('\n')}\n${rx.general_instructions || ''}`;

                  return (
                    <div
                      key={rx.id}
                      className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {rx.prescription_number}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">
                              {rx.diagnosis_summary || 'Prescription'}
                            </h3>
                            {rx.language && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                {LANGUAGE_LABELS[rx.language] || rx.language}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Doctor: {rx.doctor_name || rx.dentist_name || 'Attending Doctor'} • Issued{' '}
                            {formatDateIN(rx.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={buildWhatsAppShareUrl(patient.phone, waText)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Share via WhatsApp</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => prescriptionsApi.downloadPdf(rx.id, rx.prescription_number)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-teal-50 text-teal-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>

                      <div tabIndex={0} role="region" aria-label="Prescription medications table" className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                            <tr>
                              <th scope="col" className="py-2 px-4">Medicine</th>
                              <th scope="col" className="py-2 px-4">Dosage</th>
                              <th scope="col" className="py-2 px-4">Frequency</th>
                              <th scope="col" className="py-2 px-4">Duration</th>
                              <th scope="col" className="py-2 px-4">Instructions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rx.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-2.5 px-4 font-bold text-slate-800">
                                  {item.medicine_name || item.drug_name}
                                </td>
                                <td className="py-2.5 px-4">{item.dosage}</td>
                                <td className="py-2.5 px-4">{item.frequency}</td>
                                <td className="py-2.5 px-4">{item.duration}</td>
                                <td className="py-2.5 px-4 text-slate-600">
                                  {item.timing} {item.instructions && `— ${item.instructions}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {rx.general_instructions && (
                        <p
                          lang={rx.language || 'en'}
                          className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100"
                        >
                          <b>Patient Advice:</b> {rx.general_instructions}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Treatment Instructions Sub-Section */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Pre-Appointment & Post-Treatment Care Instructions (EN / HI / PA)
                </h2>
                <p className="text-xs text-slate-500">
                  Preview localized instructions, publish to Patient Portal, or send via WhatsApp.
                </p>
              </div>
              {instSentFeedback && (
                <span role="status" className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  {instSentFeedback}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={instLangId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Language
                </label>
                <select
                  id={instLangId}
                  value={instructionLang}
                  onChange={(e) => setInstructionLang(e.target.value as LanguageCode)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="en">English (EN)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                </select>
              </div>
              <div>
                <label htmlFor={instTemplateId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Instruction Template
                </label>
                <select
                  id={instTemplateId}
                  value={selectedInstKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedInstKey(key);
                    const found = instructionTemplates.find((t) => t.key === key);
                    if (found) setInstMessage(found.content);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {instructionTemplates.length === 0 ? (
                    <option value="">Custom Care Instruction</option>
                  ) : (
                    instructionTemplates.map((t) => (
                      <option key={t.key} value={t.key}>
                        [{t.category.replace(/_/g, ' ')}] {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={instTextId} className="block text-xs font-semibold text-slate-700 mb-1">
                Localized Care Message Preview
              </label>
              <textarea
                id={instTextId}
                rows={3}
                lang={instructionLang}
                value={instMessage}
                onChange={(e) => setInstMessage(e.target.value)}
                placeholder="Enter or select localized pre-appointment / post-treatment care instructions..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                href={buildWhatsAppShareUrl(patient.phone, instMessage)}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Share via WhatsApp</span>
              </a>

              {canEditClinical && (
                <button
                  type="button"
                  onClick={handleSendInstruction}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                >
                  Save & Dispatch to Patient
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: X-RAYS & ORAL-3D */}
      {activeTab === 'xrays' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-2xl border border-slate-800 text-white shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Scan className="w-4 h-4" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-bold tracking-tight text-white">
                  Patient Radiographs, CBCT Volumes & 3D Teeth Reconstructions
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Encrypted OPG / IOPA / raw CBCT storage & Oral-3D reconstruction viewer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadDefaultType('xray');
                  setIsDocModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload Scan / CBCT</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/xrays?patientId=${patient.id}`)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Open X-rays Studio</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between px-2 text-xs text-slate-300">
              <span className="font-bold flex items-center gap-2">
                <Box className="w-4 h-4 text-teal-400" aria-hidden="true" />
                <span>Interactive 3D Teeth Reconstruction Viewer</span>
              </span>
              <span className="text-[10px] text-teal-400 font-mono">
                {active3DModelBlobUrl ? 'Viewing Decrypted Patient 3D Scan' : 'Baseline Arch Geometry'}
              </span>
            </div>
            <div className="h-[380px] w-full rounded-xl overflow-hidden">
              <Oral3DViewer
                modelUrl={active3DModelBlobUrl || '/oral3d/models/test_teeth_std.glb'}
                activeShader="enamel"
                className="h-full"
              />
            </div>
          </div>

          {xrayAnd3DDocs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
              No radiographs or 3D models uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {xrayAnd3DDocs.map((doc) => {
                const is3D = doc.original_file_name.toLowerCase().endsWith('.glb');
                const isShared = Boolean(doc.is_shared_with_patient);

                return (
                  <div
                    key={doc.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                        <span className="font-bold text-[10px] uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {is3D ? '3D GLB Model' : doc.document_type.toUpperCase()}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isShared
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isShared ? 'Shared' : 'Private Clinical'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {doc.title || doc.original_file_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateIN(doc.media_date || doc.created_at)} •{' '}
                        {formatFileSize(doc.file_size_bytes || doc.file_size)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {is3D ? (
                          <button
                            type="button"
                            onClick={() => handleLoad3DAuthenticated(doc.id)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold flex items-center gap-1"
                          >
                            <Box className="w-3 h-3" aria-hidden="true" />
                            <span>View 3D</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLightboxDoc(doc)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-semibold flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" aria-hidden="true" />
                            <span>Preview</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => documentsApi.download(doc.id, doc.original_file_name)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>

                      {isDoctorOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleShareDocument(doc)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                            isShared
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isShared ? 'Unshare' : 'Share w/ Patient'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: CLINICAL MEDIA & 6 PHOTO TYPES */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Clinical Photography (6 Photo Types), Imaging & Documents
              </h2>
              <p className="text-xs text-slate-500">
                Organized by date or treatment stage with opt-in Patient Portal sharing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUploadDefaultType('intraoral_photo');
                setIsDocModalOpen(true);
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Upload Media / Photo
            </button>
          </div>

          {/* Filter Chips & Grouping */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="tab-scroll-strip gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => setMediaTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    mediaTypeFilter === 'all'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  All ({documents.length})
                </button>
                {MEDIA_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMediaTypeFilter(opt.value)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      mediaTypeFilter === opt.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.value.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                {(['date', 'stage', 'grid'] as const).map((gm) => (
                  <button
                    key={gm}
                    type="button"
                    onClick={() => setMediaGroupMode(gm)}
                    className={`px-2.5 py-1 rounded-md capitalize ${
                      mediaGroupMode === gm ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {gm === 'date' ? 'By Date' : gm === 'stage' ? 'By Stage' : 'Flat'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredMediaDocs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No media files matching filter.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedMediaEntries.map(([grp, list]) => (
                <div key={grp} className="space-y-2.5">
                  {mediaGroupMode !== 'grid' && (
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
                      {grp} ({list.length})
                    </h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((doc) => {
                      const isShared = Boolean(doc.is_shared_with_patient);
                      return (
                        <div
                          key={doc.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs mb-1">
                              <span className="font-bold uppercase tracking-wider text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                                {doc.document_type.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isShared
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isShared ? 'Shared with Patient' : 'Private Clinical'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 truncate mt-1">
                              {doc.title || doc.original_file_name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatDateIN(doc.media_date || doc.created_at)} •{' '}
                              {formatFileSize(doc.file_size_bytes || doc.file_size)}
                            </p>
                            {doc.disease_category && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                {doc.disease_category}
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setLightboxDoc(doc)}
                                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-semibold flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" aria-hidden="true" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => documentsApi.download(doc.id, doc.original_file_name)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>

                            {isDoctorOrAdmin && (
                              <button
                                type="button"
                                onClick={() => handleToggleShareDocument(doc)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${
                                  isShared
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                <Share2 className="w-3 h-3" aria-hidden="true" />
                                <span>{isShared ? 'Make Private' : 'Share with Patient'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: CATEGORY-SPECIFIC MISCELLANEOUS RECORDS */}
      {activeTab === 'misc' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Category-Specific Miscellaneous Clinical Records
              </h2>
              <p className="text-xs text-slate-500">
                Organized by patient&apos;s checked disease categories + General bucket (Private Clinical Record).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {miscFeedback && (
                <span role="status" className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {miscFeedback}
                </span>
              )}
              {canEditClinical && (
                <button
                  type="button"
                  disabled={isSavingMisc}
                  onClick={handleSaveMiscellaneous}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSavingMisc ? 'Saving...' : 'Save Miscellaneous Notes'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {miscBuckets.map((bucket) => {
              const boxId = `misc-cat-${bucket.replace(/\s+/g, '-').toLowerCase()}`;
              return (
                <div key={bucket} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label htmlFor={boxId} className="block text-xs font-bold text-slate-800">
                    {bucket}
                  </label>
                  <textarea
                    id={boxId}
                    rows={3}
                    disabled={!canEditClinical}
                    value={miscRecords[bucket] || ''}
                    onChange={(e) =>
                      setMiscRecords((prev) => ({ ...prev, [bucket]: e.target.value }))
                    }
                    placeholder={`Special miscellaneous clinical notes for ${bucket}...`}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 8: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Appointment History</h2>
            <button
              type="button"
              onClick={() => setIsApptModalOpen(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Book Appointment
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div tabIndex={0} role="region" aria-label="Patient appointments table" className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th scope="col" className="py-3 px-4">Date & Time</th>
                    <th scope="col" className="py-3 px-4">Doctor & Operatory</th>
                    <th scope="col" className="py-3 px-4">Type / Reason</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Calendar Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((a) => {
                    const gCal =
                      a.google_calendar_url ||
                      buildGoogleCalendarUrl({
                        title: `PGI Dental Appointment — ${displayName}`,
                        date: a.appointment_date,
                        startTime: a.start_time,
                        endTime: a.end_time,
                        details: a.reason || 'PGI Dental Consultation',
                        location: `${a.operatory || 'Operatory 1'}, Oral Health Sciences Centre, PGIMER Chandigarh`,
                      });
                    return (
                      <tr key={a.id}>
                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                          {formatDateIN(a.appointment_date)} • {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">
                            {a.doctor_name || a.dentist_name || 'Attending Doctor'}
                          </div>
                          <div className="text-[11px] text-slate-500">{a.operatory || 'Operatory 1'}</div>
                        </td>
                        <td className="py-3 px-4">{a.reason || a.appointment_type_name || 'Consultation'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={gCal}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold hover:bg-blue-100"
                            >
                              Google Cal
                            </a>
                            <button
                              type="button"
                              onClick={() => appointmentsApi.downloadIcs(a.id)}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold hover:bg-slate-200"
                            >
                              .ics
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: FOLLOW-UPS */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Scheduled Clinical Follow-ups</h2>
            <button
              type="button"
              onClick={() => setIsFollowupModalOpen(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Schedule Follow-up
            </button>
          </div>

          <div className="space-y-3">
            {followups.map((fu) => (
              <div
                key={fu.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{fu.reason}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                      {fu.status}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Target Date: <b>{formatDateIN(fu.scheduled_date)}</b> • Doctor:{' '}
                    {fu.dentist_name || 'Attending Doctor'}
                  </p>
                  {fu.notes && <p className="text-slate-600 mt-1 italic">{fu.notes}</p>}
                </div>

                {fu.status === 'pending' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await followupsApi.update(fu.id, { status: 'completed' });
                      loadPatientData();
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold"
                  >
                    Mark Done
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: MEDICAL & DENTAL HISTORY */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" aria-hidden="true" />
              <span>Medical History & Systemic Conditions</span>
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Allergies:</span>
                <p className="text-slate-800 font-bold mt-0.5">
                  {patient.medical_history?.allergies || 'No known drug allergies'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Systemic Conditions:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.medical_history?.medical_conditions || 'None declared'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Current Medications:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.medical_history?.current_medications || 'None declared'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Bleeding / Anticoagulants:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.medical_history?.bleeding_disorders
                    ? 'Positive (Patient on blood thinners)'
                    : 'None'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <span>Dental Habits & Anamnesis</span>
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Chief Complaint:</span>
                <p className="text-slate-800 font-bold mt-0.5">
                  {patient.dental_history?.chief_complaint || 'None'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Brushing Frequency:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.dental_history?.brushing_frequency || 'Twice daily'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Dental Anxiety Level:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.dental_history?.dental_anxiety_level || 'None'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Oral Habits:</span>
                <p className="text-slate-800 font-medium mt-0.5">
                  {patient.dental_history?.habits || 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: CHRONOLOGICAL TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-800">Unified Clinical History & Event Feed</h2>
          <div className="relative pl-6 border-l-2 border-slate-200 space-y-5">
            {timeline.map((event, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-teal-500 ring-4 ring-white" />
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{event.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{event.date}</span>
                  </div>
                  {event.status && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      Status: {event.status}
                    </span>
                  )}
                  {event.notes && <p className="text-xs text-slate-600 mt-2">{event.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS */}
      {/* =================================================================== */}

      {/* Add Patient Advisory Modal */}
      <Modal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        title="Add Patient Advisory (Tests / Scans to Conduct & Bring)"
        subtitle={`Visible to ${displayName} in Patient Portal`}
        icon={<BellRing className="w-4 h-4" aria-hidden="true" />}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateSharedNotice} className="p-6 space-y-4">
          <div>
            <label htmlFor={noticeTitleId} className="block text-xs font-semibold text-slate-700 mb-1">
              Advisory Title *
            </label>
            <input
              id={noticeTitleId}
              type="text"
              required
              autoFocus
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="e.g. Conduct OPG Panoramic X-ray"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={noticeTypeId} className="block text-xs font-semibold text-slate-700 mb-1">
                Advisory Type
              </label>
              <select
                id={noticeTypeId}
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="test_scan">Test / Scan to Conduct & Bring</option>
                <option value="instruction">Special Care Instruction</option>
                <option value="general">General Advisory</option>
              </select>
            </div>
            <div>
              <label htmlFor={noticeDueId} className="block text-xs font-semibold text-slate-700 mb-1">
                Bring By Date (Optional)
              </label>
              <input
                id={noticeDueId}
                type="date"
                value={noticeDueDate}
                onChange={(e) => setNoticeDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor={noticeMsgId} className="block text-xs font-semibold text-slate-700 mb-1">
              Patient-Visible Message *
            </label>
            <textarea
              id={noticeMsgId}
              rows={3}
              required
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="e.g. Please conduct an OPG X-ray and HbA1c blood test and bring films on your next visit."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNoticeModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingNotice}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {isSavingNotice ? 'Publishing...' : 'Publish to Patient Portal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Patient Registration Card Preview / Upload Modal */}
      <Modal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        title="Patient Registration Card Preview & Upload"
        subtitle={`CR Number: ${patient.cr_number || patient.patient_code}`}
        icon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
        maxWidthClass="max-w-xl"
      >
        <div className="p-6 space-y-4">
          {cardBlobUrl ? (
            <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-center max-h-72 overflow-hidden">
              <img src={cardBlobUrl} alt="Patient registration card" className="max-h-64 object-contain rounded" />
            </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              No patient registration card image uploaded yet.
            </div>
          )}

          {canEditClinical && (
            <form onSubmit={handleUploadCard} className="space-y-3 pt-2 border-t border-slate-100">
              <label htmlFor={cardInputId} className="block text-xs font-semibold text-slate-700">
                Upload / Replace Patient Card (`file`)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={cardInputId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCardFileUpload(e.target.files?.[0] || null)}
                  className="text-xs flex-1"
                />
                <button
                  type="submit"
                  disabled={!cardFileUpload}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  Upload Card
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Parent / Guardian Consent Preview & Upload Modal */}
      <Modal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        title="Parent / Guardian Consent Verification"
        subtitle={`Status: ${consentStatus.replace(/_/g, ' ').toUpperCase()}`}
        icon={<FileCheck className="w-4 h-4" aria-hidden="true" />}
        maxWidthClass="max-w-xl"
      >
        <div className="p-6 space-y-4">
          {consentBlobUrl ? (
            <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-center max-h-72 overflow-hidden">
              <img src={consentBlobUrl} alt="Signed parent guardian consent" className="max-h-64 object-contain rounded" />
            </div>
          ) : (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              No consent document image uploaded yet.
            </div>
          )}

          {canEditClinical && (
            <form onSubmit={handleUploadConsent} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={consentGuardianId} className="block text-xs font-semibold text-slate-700 mb-1">
                    Guardian Name
                  </label>
                  <input
                    id={consentGuardianId}
                    type="text"
                    value={consentGuardianName}
                    onChange={(e) => setConsentGuardianName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor={consentPhoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                    Guardian Phone
                  </label>
                  <input
                    id={consentPhoneId}
                    type="tel"
                    value={consentGuardianPhone}
                    onChange={(e) => setConsentGuardianPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={consentStatId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Consent Status
                </label>
                <select
                  id={consentStatId}
                  value={consentStatusEdit}
                  onChange={(e) => setConsentStatusEdit(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="not_required">Not Required</option>
                  <option value="pending">Pending Signature</option>
                  <option value="signed">Signed & Verified</option>
                </select>
              </div>

              <div>
                <label htmlFor={consentInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Consent Scan (`file`)
                </label>
                <input
                  id={consentInputId}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setConsentFileUpload(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
                >
                  Save Consent & Upload
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Authenticated Media Lightbox */}
      <MediaLightboxModal
        doc={lightboxDoc}
        isOpen={!!lightboxDoc}
        onClose={() => setLightboxDoc(null)}
      />

      {selectedTooth && chartData && (
        <ToothModal
          toothNumber={selectedTooth}
          conditionData={chartData.teeth[selectedTooth]}
          history={chartData.history}
          isOpen={!!selectedTooth}
          onClose={() => setSelectedTooth(null)}
          onUpdateCondition={async (data) => {
            await dentalChartApi.updateTooth(patientId, data as any);
            const freshChart = await dentalChartApi.getChart(patientId);
            setChartData(freshChart);
          }}
        />
      )}

      {isVisitModalOpen && (
        <VisitModal
          patientId={patientId}
          patientName={displayName}
          isOpen={isVisitModalOpen}
          onClose={() => setIsVisitModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isPlanModalOpen && (
        <TreatmentPlanModal
          patientId={patientId}
          patientName={displayName}
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isSurgicalModalOpen && (
        <SurgicalLogModal
          patientId={patientId}
          patientName={displayName}
          defaultSurgeon={patient.doctor_name || user?.full_name}
          availableDocs={documents}
          isOpen={isSurgicalModalOpen}
          onClose={() => setIsSurgicalModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isRxModalOpen && (
        <PrescriptionModal
          patientId={patientId}
          patientName={displayName}
          defaultLanguage={patient.preferred_language || 'en'}
          isOpen={isRxModalOpen}
          onClose={() => setIsRxModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isDocModalOpen && (
        <DocumentUploadModal
          patientId={patientId}
          patientName={displayName}
          patientDiseaseCategories={patient.disease_categories || []}
          defaultDocumentType={uploadDefaultType}
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isFollowupModalOpen && (
        <FollowUpModal
          patientId={patientId}
          patientName={displayName}
          isOpen={isFollowupModalOpen}
          onClose={() => setIsFollowupModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isApptModalOpen && (
        <AppointmentModal
          isOpen={isApptModalOpen}
          defaultPatientId={patientId}
          onClose={() => setIsApptModalOpen(false)}
          onSuccess={loadPatientData}
        />
      )}

      {isEditPatientOpen && (
        <PatientFormModal
          isOpen={isEditPatientOpen}
          initialData={patient}
          onClose={() => setIsEditPatientOpen(false)}
          onSubmit={async (payload) => {
            const res = await patientsApi.update(patientId, payload);
            await loadPatientData();
            return res;
          }}
        />
      )}
    </div>
  );
};

export default PatientDetail;
