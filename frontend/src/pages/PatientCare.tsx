import React, { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    BellRing,
    Send,
    CalendarClock,
    HeartPulse,
    Share2,
    MessageCircle,
    CheckCircle2,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { notificationsApi } from '../api/notifications';
import { integrationsApi } from '../api/integrations';
import { patientsApi } from '../api/patients';
import { LanguageCode, Patient, PreventiveCareMessage, SocialSettings } from '../types';
import { buildWhatsAppShareUrl, formatDateIN, formatDateTimeIN, LANGUAGE_LABELS } from '../utils/formatters';

export default function PatientCare() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'notifications' | 'recalls' | 'preventive' | 'social'>(
        'notifications'
    );
    const [feedback, setFeedback] = useState<string | null>(null);

    // Settings & Manual Alert State
    const [smsSenderId, setSmsSenderId] = useState('PGIDNT');
    const [smsProvider, setSmsProvider] = useState('sandbox');
    const [alertPatientId, setAlertPatientId] = useState<string>('');
    const [alertChannel, setAlertChannel] = useState<'sms' | 'email'>('sms');
    const [alertLang, setAlertLang] = useState<LanguageCode>('en');
    const [alertMessage, setAlertMessage] = useState(
        'PGI Dental Branch Reminder: Please confirm your upcoming appointment at Oral Health Sciences Centre, PGIMER Chandigarh.'
    );

    // Preventive Care State
    const [prevPatientId, setPrevPatientId] = useState<string>('');
    const [prevLang, setPrevLang] = useState<LanguageCode>('en');
    const [prevPreview, setPrevPreview] = useState<PreventiveCareMessage | null>(null);
    const [prevChannel, setPrevChannel] = useState<'sms' | 'email' | 'whatsapp'>('sms');

    // Social Media Hub State
    const [socialSettings, setSocialSettings] = useState<SocialSettings>({
        whatsapp_number: '+919876543210',
        instagram_url: 'https://instagram.com/pgidentalchandigarh',
        facebook_url: 'https://facebook.com/pgidentalchandigarh',
        youtube_url: 'https://youtube.com/@pgidental',
    });
    const [leadName, setLeadName] = useState('');
    const [leadPhone, setLeadPhone] = useState('');
    const [leadChannel, setLeadChannel] = useState<'whatsapp' | 'instagram' | 'facebook'>('whatsapp');
    const [leadMessage, setLeadMessage] = useState('');
    const [campaignLang, setCampaignLang] = useState<LanguageCode>('en');

    const senderInputId = useId();
    const providerSelectId = useId();
    const alertPatId = useId();
    const alertChanId = useId();
    const alertLangId = useId();
    const alertMsgId = useId();
    const prevPatSelectId = useId();
    const prevLangSelectId = useId();
    const prevChanSelectId = useId();
    const waNumId = useId();
    const igUrlId = useId();
    const fbUrlId = useId();
    const ytUrlId = useId();
    const leadNameId = useId();
    const leadPhoneId = useId();
    const leadChanId = useId();
    const leadMsgId = useId();
    const campLangId = useId();

    const { data: patientsRes } = useQuery({
        queryKey: ['patientCarePatients'],
        queryFn: () => patientsApi.list({ page: 1, pageSize: 100 }),
    });
    const patients: Patient[] = patientsRes?.items || [];

    const { data: logs = [] } = useQuery({
        queryKey: ['notificationLogs'],
        queryFn: () => notificationsApi.getLogs().catch(() => []),
    });

    const { data: recalls = [] } = useQuery({
        queryKey: ['automaticRecalls'],
        queryFn: () => notificationsApi.listRecalls().catch(() => []),
    });

    useEffect(() => {
        notificationsApi
            .getSettings()
            .then((s) => {
                if (s?.sms_sender_id) setSmsSenderId(s.sms_sender_id);
                if (s?.sms_provider) setSmsProvider(s.sms_provider);
            })
            .catch(() => { });

        integrationsApi
            .getSocialSettings()
            .then((s) => {
                if (s) setSocialSettings((prev) => ({ ...prev, ...s }));
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (patients.length > 0 && !alertPatientId) setAlertPatientId(String(patients[0].id));
        if (patients.length > 0 && !prevPatientId) setPrevPatientId(String(patients[0].id));
    }, [patients]);

    useEffect(() => {
        if (!prevPatientId) return;
        notificationsApi
            .previewPreventiveCare(Number(prevPatientId), prevLang)
            .then(setPrevPreview)
            .catch(() => setPrevPreview(null));
    }, [prevPatientId, prevLang]);

    const showToast = (msg: string) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(null), 4000);
    };

    const saveSmsSettingsMutation = useMutation({
        mutationFn: () =>
            notificationsApi.updateSettings({
                sms_sender_id: smsSenderId.trim().toUpperCase(),
                sms_provider: smsProvider,
            }),
        onSuccess: () => showToast(`SMS Sender ID "${smsSenderId.toUpperCase()}" saved.`),
    });

    const sendAlertMutation = useMutation({
        mutationFn: () =>
            notificationsApi.sendNotification({
                patient_id: Number(alertPatientId),
                channel: alertChannel,
                language: alertLang,
                message_body: alertMessage,
                category: 'manual_alert',
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notificationLogs'] });
            showToast('Notification dispatched & logged.');
        },
    });

    const generateRecallsMutation = useMutation({
        mutationFn: notificationsApi.generateRecalls,
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['automaticRecalls'] });
            showToast(res?.message || `Generated ${res?.generated_count ?? 0} recalls.`);
        },
    });

    const dispatchRecallsMutation = useMutation({
        mutationFn: notificationsApi.dispatchDueRecalls,
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['automaticRecalls'] });
            queryClient.invalidateQueries({ queryKey: ['notificationLogs'] });
            showToast(res?.message || `Dispatched ${res?.dispatched_count ?? 0} due recalls.`);
        },
    });

    const sendPreventiveMutation = useMutation({
        mutationFn: () =>
            notificationsApi.sendPreventiveCare({
                patient_id: Number(prevPatientId),
                language: prevLang,
                channel: prevChannel,
                custom_message: prevPreview?.message_body,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notificationLogs'] });
            showToast('Preventive care message sent & logged.');
        },
    });

    const saveSocialMutation = useMutation({
        mutationFn: () => integrationsApi.updateSocialSettings(socialSettings),
        onSuccess: () => showToast('PGI Dental social media channels saved.'),
    });

    const submitLeadMutation = useMutation({
        mutationFn: () =>
            integrationsApi.submitSocialLead({
                caller_name: leadName.trim(),
                phone: leadPhone.trim(),
                source_channel: leadChannel,
                message: leadMessage.trim(),
                preferred_language: campaignLang,
            }),
        onSuccess: () => {
            setLeadName('');
            setLeadPhone('');
            setLeadMessage('');
            showToast('Social lead captured directly into Patient Tracker!');
        },
    });

    const campaignMessageByLang: Record<LanguageCode, string> = {
        en: 'PGI Dental Branch (PGIMER Chandigarh): Book your 6-monthly oral health & periodontal screening today!',
        hi: 'पीजीआई डेंटल ब्रांच (PGIMER चंडीगढ़): आज ही अपनी 6-मासिक दंत एवं मसूड़ों की जांच बुक करें!',
        pa: 'ਪੀ.ਜੀ.ਆਈ. ਡੈਂਟਲ ਬ੍ਰਾਂਚ (PGIMER ਚੰਡੀਗੜ੍ਹ): ਅੱਜ ਹੀ ਆਪਣੀ 6-ਮਹੀਨੇ ਦੀ ਦੰਦਾਂ ਦੀ ਜਾਂਚ ਬੁੱਕ ਕਰੋ!',
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                        <BellRing className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                            Patient Care, Recalls & Communications Hub
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            SMS Sender ID configuration, automatic 6-month/treatment recalls, preventive campaigns (EN/HI/PA) & Social Media intake.
                        </p>
                    </div>
                </div>
            </div>

            {feedback && (
                <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>{feedback}</span>
                </div>
            )}

            {/* Single-row scrollable 4-tab bar */}
            <div role="tablist" aria-label="Patient Care Hub modules" className="tab-scroll-strip border-b border-slate-200 text-xs font-semibold">
                {[
                    { id: 'notifications', label: 'Notification Center & SMS Sender ID', icon: Send },
                    { id: 'recalls', label: `Automatic Recalls (${recalls.length})`, icon: CalendarClock },
                    { id: 'preventive', label: 'Preventive Care Campaigns', icon: HeartPulse },
                    { id: 'social', label: 'Social Media Hub', icon: Share2 },
                ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === tab.id
                                    ? 'border-teal-600 text-teal-800 font-bold bg-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: NOTIFICATION CENTER & SMS SENDER ID */}
            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* SMS Sender ID Config */}
                        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h2 className="text-sm font-bold text-slate-900">SMS Sender ID & Provider Settings</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={senderInputId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        SMS Sender ID (6 chars)
                                    </label>
                                    <input
                                        id={senderInputId}
                                        type="text"
                                        maxLength={11}
                                        value={smsSenderId}
                                        onChange={(e) => setSmsSenderId(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={providerSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Gateway Mode
                                    </label>
                                    <select
                                        id={providerSelectId}
                                        value={smsProvider}
                                        onChange={(e) => setSmsProvider(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                    >
                                        <option value="sandbox">Sandbox (Logged Audit Mode)</option>
                                        <option value="twilio">Twilio SMS</option>
                                        <option value="msg91">MSG91 India DLT</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={saveSmsSettingsMutation.isPending}
                                onClick={() => saveSmsSettingsMutation.mutate()}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
                            >
                                Save Sender ID Configuration
                            </button>
                        </div>

                        {/* Send Test / Manual Alert */}
                        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h2 className="text-sm font-bold text-slate-900">Dispatch Localized SMS / Email Alert</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label htmlFor={alertPatId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Patient
                                    </label>
                                    <select
                                        id={alertPatId}
                                        value={alertPatientId}
                                        onChange={(e) => setAlertPatientId(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                    >
                                        {patients.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.full_name || `${p.first_name} ${p.last_name}`} ({p.cr_number || p.patient_code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor={alertChanId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Channel
                                    </label>
                                    <select
                                        id={alertChanId}
                                        value={alertChannel}
                                        onChange={(e) => setAlertChannel(e.target.value as any)}
                                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                    >
                                        <option value="sms">SMS ({smsSenderId})</option>
                                        <option value="email">Email</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor={alertLangId} className="block text-xs font-semibold text-slate-700 mb-1">
                                        Language
                                    </label>
                                    <select
                                        id={alertLangId}
                                        value={alertLang}
                                        onChange={(e) => setAlertLang(e.target.value as LanguageCode)}
                                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">हिंदी</option>
                                        <option value="pa">ਪੰਜਾਬੀ</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label htmlFor={alertMsgId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Message Content
                                </label>
                                <textarea
                                    id={alertMsgId}
                                    rows={2}
                                    value={alertMessage}
                                    onChange={(e) => setAlertMessage(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    disabled={!alertPatientId || sendAlertMutation.isPending}
                                    onClick={() => sendAlertMutation.mutate()}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                                >
                                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Send Alert Now</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Log Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900">SMS & Email Delivery Log</h2>
                            <span className="text-xs text-slate-500">{logs.length} notifications logged</span>
                        </div>
                        <div tabIndex={0} role="region" aria-label="Notification delivery log table" className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                                    <tr>
                                        <th scope="col" className="py-2.5 px-4">Sent At</th>
                                        <th scope="col" className="py-2.5 px-4">Sender ID</th>
                                        <th scope="col" className="py-2.5 px-4">Recipient</th>
                                        <th scope="col" className="py-2.5 px-4">Channel / Lang</th>
                                        <th scope="col" className="py-2.5 px-4">Message</th>
                                        <th scope="col" className="py-2.5 px-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-400">
                                                No notifications dispatched yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50/70">
                                                <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 font-mono">
                                                    {formatDateTimeIN(log.created_at)}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono font-bold text-teal-800">
                                                    {log.sender_id || smsSenderId}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <div className="font-semibold text-slate-800">{log.patient_name || log.recipient}</div>
                                                    <div className="text-[11px] font-mono text-slate-500">{log.recipient}</div>
                                                </td>
                                                <td className="py-2.5 px-4 whitespace-nowrap uppercase font-bold text-[10px]">
                                                    {log.channel} • {log.language}
                                                </td>
                                                <td className="py-2.5 px-4 max-w-xs truncate text-slate-700">{log.message_body}</td>
                                                <td className="py-2.5 px-4 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                                                        {log.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: AUTOMATIC RECALLS */}
            {activeTab === 'recalls' && (
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">
                                Automatic Recall Engine (Regular 6-Month & Treatment-Specific)
                            </h2>
                            <p className="text-xs text-slate-500">
                                Schedules suture removal (7d), crown checks (14d), RCT follow-ups (30d), perio maintenance (90d) & 6-month recalls.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={generateRecallsMutation.isPending}
                                onClick={() => generateRecallsMutation.mutate()}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Generate Recalls</span>
                            </button>
                            <button
                                type="button"
                                disabled={dispatchRecallsMutation.isPending}
                                onClick={() => dispatchRecallsMutation.mutate()}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Dispatch Due Recalls</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div tabIndex={0} role="region" aria-label="Patient recalls table" className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                                    <tr>
                                        <th scope="col" className="py-3 px-4">CR Number</th>
                                        <th scope="col" className="py-3 px-4">Patient</th>
                                        <th scope="col" className="py-3 px-4">Recall Rule</th>
                                        <th scope="col" className="py-3 px-4">Scheduled Date</th>
                                        <th scope="col" className="py-3 px-4">Lang</th>
                                        <th scope="col" className="py-3 px-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recalls.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-slate-400">
                                                Click &quot;Generate Recalls&quot; to evaluate patients and create recall reminders.
                                            </td>
                                        </tr>
                                    ) : (
                                        recalls.map((r) => (
                                            <tr key={r.id}>
                                                <td className="py-3 px-4 font-mono font-bold text-teal-800">
                                                    {r.cr_number || `PAT-${r.patient_id}`}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-slate-900">{r.patient_name}</td>
                                                <td className="py-3 px-4 capitalize">{r.recall_type.replace(/_/g, ' ')}</td>
                                                <td className="py-3 px-4 font-mono">{formatDateIN(r.scheduled_date)}</td>
                                                <td className="py-3 px-4 uppercase font-bold text-[10px]">{r.language}</td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold uppercase">
                                                        {r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PREVENTIVE CARE CAMPAIGNS */}
            {activeTab === 'preventive' && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-teal-600" aria-hidden="true" />
                            <span>Rule-Based Preventive Care Messaging (Demographics / Conditions / Habits)</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Evaluates patient age group, systemic illnesses (diabetes, pregnancy), dental conditions, and tobacco/oral habits.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor={prevPatSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Target Patient
                            </label>
                            <select
                                id={prevPatSelectId}
                                value={prevPatientId}
                                onChange={(e) => setPrevPatientId(e.target.value)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                            >
                                {patients.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.full_name || `${p.first_name} ${p.last_name}`} ({p.cr_number || p.patient_code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor={prevLangSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Message Language
                            </label>
                            <select
                                id={prevLangSelectId}
                                value={prevLang}
                                onChange={(e) => setPrevLang(e.target.value as LanguageCode)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                            >
                                <option value="en">English (EN)</option>
                                <option value="hi">हिंदी (Hindi)</option>
                                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={prevChanSelectId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Dispatch Channel
                            </label>
                            <select
                                id={prevChanSelectId}
                                value={prevChannel}
                                onChange={(e) => setPrevChannel(e.target.value as any)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                            >
                                <option value="sms">SMS ({smsSenderId})</option>
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                        </div>
                    </div>

                    {prevPreview ? (
                        <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-3" lang={prevLang}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-teal-950">{prevPreview.title}</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {(prevPreview.matched_factors || []).map((f) => (
                                        <span key={f} className="px-2 py-0.5 rounded-full bg-white text-teal-800 border border-teal-200 text-[10px] font-bold">
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                                {prevPreview.message_body}
                            </p>
                            <div className="flex flex-wrap justify-end gap-2 pt-2">
                                <a
                                    href={buildWhatsAppShareUrl(
                                        patients.find((x) => String(x.id) === prevPatientId)?.phone,
                                        prevPreview.message_body
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Share via WhatsApp</span>
                                </a>
                                <button
                                    type="button"
                                    disabled={sendPreventiveMutation.isPending}
                                    onClick={() => sendPreventiveMutation.mutate()}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                                >
                                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Send Preventive Care Message</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
                            Select a patient above to preview tailored preventive dental care guidance.
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: SOCIAL MEDIA HUB */}
            {activeTab === 'social' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Clinic Social Channels Config + WhatsApp Campaign Share */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900">PGI Dental Social Media Channels</h2>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor={waNumId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    WhatsApp Official Number
                                </label>
                                <input
                                    id={waNumId}
                                    type="text"
                                    value={socialSettings.whatsapp_number}
                                    onChange={(e) =>
                                        setSocialSettings({ ...socialSettings, whatsapp_number: e.target.value })
                                    }
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                                />
                            </div>
                            <div>
                                <label htmlFor={igUrlId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Instagram Handle / URL
                                </label>
                                <input
                                    id={igUrlId}
                                    type="url"
                                    value={socialSettings.instagram_url}
                                    onChange={(e) =>
                                        setSocialSettings({ ...socialSettings, instagram_url: e.target.value })
                                    }
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label htmlFor={fbUrlId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Facebook Page URL
                                </label>
                                <input
                                    id={fbUrlId}
                                    type="url"
                                    value={socialSettings.facebook_url}
                                    onChange={(e) =>
                                        setSocialSettings({ ...socialSettings, facebook_url: e.target.value })
                                    }
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label htmlFor={ytUrlId} className="block text-xs font-semibold text-slate-700 mb-1">
                                    YouTube Patient Education Channel
                                </label>
                                <input
                                    id={ytUrlId}
                                    type="url"
                                    value={socialSettings.youtube_url}
                                    onChange={(e) =>
                                        setSocialSettings({ ...socialSettings, youtube_url: e.target.value })
                                    }
                                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => saveSocialMutation.mutate()}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
                        >
                            Save Social Channels
                        </button>

                        <div className="pt-4 border-t border-slate-100 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <label htmlFor={campLangId} className="text-xs font-bold text-slate-800">
                                    One-Click Oral Health Campaign Share
                                </label>
                                <select
                                    id={campLangId}
                                    value={campaignLang}
                                    onChange={(e) => setCampaignLang(e.target.value as LanguageCode)}
                                    className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg bg-white"
                                >
                                    {(['en', 'hi', 'pa'] as const).map((l) => (
                                        <option key={l} value={l}>
                                            {LANGUAGE_LABELS[l]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200" lang={campaignLang}>
                                {campaignMessageByLang[campaignLang]}
                            </p>
                            <a
                                href={buildWhatsAppShareUrl(undefined, campaignMessageByLang[campaignLang])}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                            >
                                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                                <span>Share Campaign on WhatsApp</span>
                            </a>
                        </div>
                    </div>

                    {/* Simulate Social Lead Intake into Patient Tracker */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!leadName.trim() || !leadPhone.trim()) return;
                            submitLeadMutation.mutate();
                        }}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                    >
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">
                                Capture / Simulate Social Lead into Patient Tracker
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Webhook intake (`POST /api/v1/integrations/social-lead`) creates an enquiry directly inside Patient Tracker.
                            </p>
                        </div>

                        <div>
                            <label htmlFor={leadChanId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Social Platform
                            </label>
                            <select
                                id={leadChanId}
                                value={leadChannel}
                                onChange={(e) => setLeadChannel(e.target.value as any)}
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                            >
                                <option value="whatsapp">WhatsApp</option>
                                <option value="instagram">Instagram DM</option>
                                <option value="facebook">Facebook Lead</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor={leadNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Lead Full Name *
                            </label>
                            <input
                                id={leadNameId}
                                type="text"
                                required
                                value={leadName}
                                onChange={(e) => setLeadName(e.target.value)}
                                placeholder="e.g. Simran Kaur"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>

                        <div>
                            <label htmlFor={leadPhoneId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Phone / WhatsApp Number *
                            </label>
                            <input
                                id={leadPhoneId}
                                type="tel"
                                required
                                value={leadPhone}
                                onChange={(e) => setLeadPhone(e.target.value)}
                                placeholder="+91 98765 55443"
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>

                        <div>
                            <label htmlFor={leadMsgId} className="block text-xs font-semibold text-slate-700 mb-1">
                                Incoming Enquiry Message *
                            </label>
                            <textarea
                                id={leadMsgId}
                                rows={3}
                                required
                                value={leadMessage}
                                onChange={(e) => setLeadMessage(e.target.value)}
                                placeholder="e.g. Looking for consultation for molar sensitivity & OPG scan..."
                                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitLeadMutation.isPending}
                            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                            {submitLeadMutation.isPending ? 'Capturing Lead...' : 'Send Lead to Patient Tracker'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

