import React, { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
    GitBranch,
    PhoneCall,
    Plus,
    AlertTriangle,
    UserPlus,
    MessageCircle,
    ArrowRight,
    Calendar,
} from 'lucide-react';
import { trackerApi } from '../api/tracker';
import { doctorsApi } from '../api/doctors';
import { studentsApi } from '../api/students';
import { useAuth } from '../context/AuthContext';
import { LanguageCode, TrackerEnquiry, TrackerStage } from '../types';
import Modal from '../components/common/Modal';
import { buildWhatsAppShareUrl, formatDateIN } from '../utils/formatters';

const STAGES: { key: TrackerStage; label: string; colorClass: string }[] = [
    { key: 'enquiry', label: 'Enquiry', colorClass: 'bg-slate-100 text-slate-800 border-slate-200' },
    { key: 'registered', label: 'Registered', colorClass: 'bg-blue-50 text-blue-800 border-blue-200' },
    { key: 'diagnosed', label: 'Diagnosed', colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
    { key: 'in_treatment', label: 'In Treatment', colorClass: 'bg-teal-50 text-teal-800 border-teal-200' },
    { key: 'followup', label: 'Follow-up', colorClass: 'bg-purple-50 text-purple-800 border-purple-200' },
    { key: 'slipping', label: 'Slipping', colorClass: 'bg-rose-50 text-rose-800 border-rose-200' },
    { key: 'completed', label: 'Completed', colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
];

export default function PatientTracker() {
    const { hasRole } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isDoctorOrAdmin = hasRole('admin', 'doctor', 'dentist');

    const [activeTab, setActiveTab] = useState<'enquiries' | 'slipping'>('enquiries');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    // Enquiry Form State
    const [callerName, setCallerName] = useState('');
    const [phone, setPhone] = useState('');
    const [sourceChannel, setSourceChannel] = useState<'phone_enquiry' | 'whatsapp' | 'instagram' | 'facebook' | 'referral' | 'walk_in'>('phone_enquiry');
    const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('en');
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [followupDate, setFollowupDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [assignedDoctorId, setAssignedDoctorId] = useState<number | ''>('');
    const [assignedStudentId, setAssignedStudentId] = useState<number | ''>('');
    const [formError, setFormError] = useState<string | null>(null);

    const callerId = useId();
    const phoneId = useId();
    const channelId = useId();
    const langId = useId();
    const complaintId = useId();
    const followupId = useId();
    const docId = useId();
    const stuId = useId();
    const notesId = useId();

    const { data: overview } = useQuery({
        queryKey: ['trackerOverview'],
        queryFn: trackerApi.getOverview,
    });

    const { data: enquiries = [], isLoading: loadingEnquiries } = useQuery({
        queryKey: ['trackerEnquiries', stageFilter],
        queryFn: () =>
            trackerApi.listEnquiries(stageFilter !== 'all' ? { stage: stageFilter } : undefined),
    });

    const { data: slipping = [], isLoading: loadingSlipping } = useQuery({
        queryKey: ['trackerSlipping'],
        queryFn: trackerApi.getSlippingPatients,
    });

    const { data: doctors = [] } = useQuery({
        queryKey: ['trackerDoctors'],
        queryFn: () => doctorsApi.list(),
        enabled: isDoctorOrAdmin,
    });

    const { data: students = [] } = useQuery({
        queryKey: ['trackerStudents'],
        queryFn: () => studentsApi.list(),
        enabled: isDoctorOrAdmin,
    });

    const createEnquiryMutation = useMutation({
        mutationFn: trackerApi.createEnquiry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trackerOverview'] });
            queryClient.invalidateQueries({ queryKey: ['trackerEnquiries'] });
            setIsEnquiryModalOpen(false);
            setCallerName('');
            setPhone('');
            setChiefComplaint('');
            setNotes('');
            setFormError(null);
            setFeedback('Enquiry logged in PGI Patient Tracker.');
        },
        onError: (err: any) => {
            setFormError(err.message || 'Failed to log enquiry');
        },
    });

    const updateStageMutation = useMutation({
        mutationFn: ({ id, stage }: { id: number; stage: TrackerStage }) =>
            trackerApi.updateEnquiry(id, { stage }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trackerOverview'] });
            queryClient.invalidateQueries({ queryKey: ['trackerEnquiries'] });
        },
    });

    const convertMutation = useMutation({
        mutationFn: (id: number) => trackerApi.convertEnquiry(id),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['trackerOverview'] });
            queryClient.invalidateQueries({ queryKey: ['trackerEnquiries'] });
            if (res?.patient?.id) {
                navigate(`/patients/${res.patient.id}`);
            } else {
                setFeedback(res?.message || 'Enquiry converted to registered patient.');
            }
        },
        onError: (err: any) => {
            alert(err.message || 'Conversion failed');
        },
    });

    const handleLogSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!callerName.trim() || !phone.trim()) {
            setFormError('Caller name and phone number are required.');
            return;
        }
        createEnquiryMutation.mutate({
            caller_name: callerName.trim(),
            phone: phone.trim(),
            source_channel: sourceChannel,
            preferred_language: preferredLanguage,
            chief_complaint: chiefComplaint.trim() || undefined,
            followup_date: followupDate || undefined,
            notes: notes.trim() || undefined,
            assigned_doctor_id: assignedDoctorId ? Number(assignedDoctorId) : null,
            assigned_student_id: assignedStudentId ? Number(assignedStudentId) : null,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                        <GitBranch className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                            Patient Tracker & Enquiry Funnel
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Track telephonic & social media leads from enquiry through treatment completion, and catch slipping patients.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsEnquiryModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Log Telephonic / Social Enquiry</span>
                </button>
            </div>

            {feedback && (
                <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex justify-between">
                    <span>{feedback}</span>
                    <button type="button" onClick={() => setFeedback(null)} className="underline">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Stage Overview Funnel Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {STAGES.map((st) => {
                    const count = overview?.stage_counts?.[st.key] ?? 0;
                    const isActive = stageFilter === st.key;
                    return (
                        <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                                setStageFilter(isActive ? 'all' : st.key);
                                if (st.key === 'slipping') setActiveTab('slipping');
                                else setActiveTab('enquiries');
                            }}
                            className={`p-3.5 rounded-2xl border text-left transition-all ${isActive ? 'ring-2 ring-teal-500 shadow-md ' : 'hover:shadow-sm '
                                }${st.colorClass}`}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                                {st.label}
                            </div>
                            <div className="text-2xl font-black mt-1">{count}</div>
                        </button>
                    );
                })}
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Tracker views" className="tab-scroll-strip border-b border-slate-200 gap-1 text-xs font-semibold">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'enquiries'}
                    onClick={() => setActiveTab('enquiries')}
                    className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${activeTab === 'enquiries'
                            ? 'border-teal-600 text-teal-700 font-bold bg-white'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                >
                    <PhoneCall className="w-4 h-4" aria-hidden="true" />
                    <span>Telephonic & Social Enquiries ({enquiries.length})</span>
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'slipping'}
                    onClick={() => setActiveTab('slipping')}
                    className={`py-3 px-4 border-b-2 flex items-center gap-2 transition ${activeTab === 'slipping'
                            ? 'border-rose-600 text-rose-700 font-bold bg-white'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <span>Slipping Patients Alert ({slipping.length})</span>
                </button>
            </div>

            {/* Tab 1: Enquiries Table */}
            {activeTab === 'enquiries' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loadingEnquiries ? (
                        <div className="p-10 text-center text-xs text-slate-400">Loading enquiries...</div>
                    ) : enquiries.length === 0 ? (
                        <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                            <PhoneCall className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
                            <p className="font-semibold text-slate-700">No enquiries matching this stage</p>
                        </div>
                    ) : (
                        <div tabIndex={0} role="region" aria-label="Patient enquiries table" className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th scope="col" className="py-3 px-4">Caller & Contact</th>
                                        <th scope="col" className="py-3 px-4">Channel</th>
                                        <th scope="col" className="py-3 px-4">Chief Complaint / Notes</th>
                                        <th scope="col" className="py-3 px-4">Follow-up</th>
                                        <th scope="col" className="py-3 px-4">Stage</th>
                                        <th scope="col" className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {enquiries.map((enq: TrackerEnquiry) => (
                                        <tr key={enq.id} className="hover:bg-slate-50/70">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{enq.caller_name}</div>
                                                <div className="font-mono text-[11px] text-slate-500">{enq.phone}</div>
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                                                    {enq.source_channel.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 max-w-xs">
                                                <div className="font-medium text-slate-800">{enq.chief_complaint || 'General Enquiry'}</div>
                                                {enq.notes && <div className="text-[11px] text-slate-500 truncate">{enq.notes}</div>}
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                                                {enq.followup_date ? formatDateIN(enq.followup_date) : formatDateIN(enq.created_at)}
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <label htmlFor={`enq-stage-${enq.id}`} className="visually-hidden">
                                                    Update stage for {enq.caller_name}
                                                </label>
                                                <select
                                                    id={`enq-stage-${enq.id}`}
                                                    value={enq.stage}
                                                    onChange={(e) =>
                                                        updateStageMutation.mutate({
                                                            id: enq.id,
                                                            stage: e.target.value as TrackerStage,
                                                        })
                                                    }
                                                    className="text-xs px-2 py-1 border border-slate-300 rounded-lg bg-white font-semibold"
                                                >
                                                    {STAGES.map((s) => (
                                                        <option key={s.key} value={s.key}>
                                                            {s.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                {enq.converted_patient_id ? (
                                                    <Link
                                                        to={`/patients/${enq.converted_patient_id}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold"
                                                    >
                                                        <span>View Patient</span>
                                                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                                    </Link>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={convertMutation.isPending}
                                                        onClick={() => convertMutation.mutate(enq.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                                                    >
                                                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                                                        <span>Convert to Registered Patient</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Slipping Patients Panel */}
            {activeTab === 'slipping' && (
                <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
                    {loadingSlipping ? (
                        <div className="p-10 text-center text-xs text-slate-400">Checking slipping patients...</div>
                    ) : slipping.length === 0 ? (
                        <div className="p-12 text-center text-xs text-slate-500">
                            No slipping or overdue patients detected right now.
                        </div>
                    ) : (
                        <div tabIndex={0} role="region" aria-label="Slipping patients alert table" className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-rose-50/70 border-b border-rose-200 text-rose-900 font-semibold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th scope="col" className="py-3 px-4">CR Number</th>
                                        <th scope="col" className="py-3 px-4">Patient</th>
                                        <th scope="col" className="py-3 px-4">Drop-Off Reason</th>
                                        <th scope="col" className="py-3 px-4">Overdue</th>
                                        <th scope="col" className="py-3 px-4 text-right">Quick Recall Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {slipping.map((sp) => (
                                        <tr key={`${sp.patient_id}-${sp.reason}`} className="hover:bg-rose-50/30">
                                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                                                {sp.cr_number || `PAT-${sp.patient_id}`}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-slate-900">{sp.patient_name}</div>
                                                <div className="text-[11px] font-mono text-slate-500">{sp.phone}</div>
                                            </td>
                                            <td className="py-3.5 px-4 text-rose-800 font-medium">{sp.reason}</td>
                                            <td className="py-3.5 px-4">
                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                                    {sp.days_overdue} days
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2">
                                                    <a
                                                        href={buildWhatsAppShareUrl(
                                                            sp.phone,
                                                            `Namaste ${sp.patient_name}, reminder from PGI Dental Branch (PGIMER Chandigarh) to schedule your pending dental follow-up visit.`
                                                        )}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                                        <span>WhatsApp Recall</span>
                                                    </a>
                                                    <Link
                                                        to="/appointments"
                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                                                        <span>Schedule</span>
                                                    </Link>
                                                    <Link
                                                        to={`/patients/${sp.patient_id}`}
                                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold"
                                                    >
                                                        Open EMR
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Log Enquiry Modal */}
            <Modal
                isOpen={isEnquiryModalOpen}
                onClose={() => setIsEnquiryModalOpen(false)}
                title="Log Telephonic or Social Media Enquiry"
                subtitle="Capture incoming caller/lead directly into the PGI Dental Patient Tracker"
                icon={<PhoneCall className="w-4 h-4" aria-hidden="true" />}
                maxWidthClass="max-w-lg"
            >
                <form onSubmit={handleLogSubmit} className="p-6 space-y-4">
                    {formError && (
                        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                            {formError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={callerId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Caller / Lead Name *
                            </label>
                            <input
                                id={callerId}
                                type="text"
                                required
                                autoFocus
                                value={callerName}
                                onChange={(e) => setCallerName(e.target.value)}
                                placeholder="e.g. Gurpreet Kaur"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label htmlFor={phoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Phone Number *
                            </label>
                            <input
                                id={phoneId}
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 98765 11223"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label htmlFor={channelId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Source Channel
                            </label>
                            <select
                                id={channelId}
                                value={sourceChannel}
                                onChange={(e) => setSourceChannel(e.target.value as any)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                            >
                                <option value="phone_enquiry">Telephonic Enquiry</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="instagram">Instagram</option>
                                <option value="facebook">Facebook</option>
                                <option value="referral">Referral</option>
                                <option value="walk_in">Walk-in</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={langId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Preferred Language
                            </label>
                            <select
                                id={langId}
                                value={preferredLanguage}
                                onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                            >
                                <option value="en">English</option>
                                <option value="hi">हिंदी</option>
                                <option value="pa">ਪੰਜਾਬੀ</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={followupId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Follow-up Date
                            </label>
                            <input
                                id={followupId}
                                type="date"
                                value={followupDate}
                                onChange={(e) => setFollowupDate(e.target.value)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor={complaintId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Chief Complaint / Reason for Enquiry
                        </label>
                        <input
                            id={complaintId}
                            type="text"
                            value={chiefComplaint}
                            onChange={(e) => setChiefComplaint(e.target.value)}
                            placeholder="e.g. Wisdom tooth pain, orthodontic consultation..."
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                        />
                    </div>

                    {isDoctorOrAdmin && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor={docId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Assign Doctor (Optional)
                                </label>
                                <select
                                    id={docId}
                                    value={assignedDoctorId}
                                    onChange={(e) => setAssignedDoctorId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                >
                                    <option value="">Unassigned</option>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.full_name || d.doctor_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor={stuId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Assign Student (Optional)
                                </label>
                                <select
                                    id={stuId}
                                    value={assignedStudentId}
                                    onChange={(e) => setAssignedStudentId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                >
                                    <option value="">Unassigned</option>
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.full_name || s.student_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor={notesId} className="block text-xs font-semibold text-slate-700 mb-1">
                            Call / Lead Notes
                        </label>
                        <textarea
                            id={notesId}
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any call summary or patient callback preference..."
                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsEnquiryModalOpen(false)}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createEnquiryMutation.isPending}
                            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                            {createEnquiryMutation.isPending ? 'Saving...' : 'Save Enquiry'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

