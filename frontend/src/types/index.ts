export type Role = 'admin' | 'dentist' | 'doctor' | 'student' | 'receptionist' | 'patient';

export type LanguageCode = 'en' | 'hi' | 'pa';

export type SeverityLevel = 'none' | 'mild' | 'moderate' | 'severe' | 'critical';

export type TrackerStage =
    | 'enquiry'
    | 'registered'
    | 'diagnosed'
    | 'in_treatment'
    | 'followup'
    | 'slipping'
    | 'completed';

export type TreatmentStage =
    | 'initial_assessment'
    | 'pre_treatment'
    | 'mid_treatment'
    | 'surgery'
    | 'post_treatment'
    | 'follow_up';

export type MediaDocumentType =
    | 'xray'
    | 'opg'
    | 'cbct'
    | 'intraoral_photo'
    | 'extraoral_photo'
    | 'iop_photo'
    | 'profile_photo'
    | 'surgery_photo'
    | 'misc_photo'
    | 'patient_card'
    | 'parent_consent'
    | 'lab_report'
    | 'other';

export interface Doctor {
    id: number;
    user_id?: number;
    full_name?: string;
    doctor_name: string;
    email: string;
    phone?: string;
    phone_number?: string;
    qualification?: string;
    specialization: string;
    department?: string;
    license_number?: string;
    registration_number: string;
    cabin_operatory?: string;
    is_admin?: boolean;
    is_active?: boolean;
    account_status: string;
    google_calendar_id?: string | null;
    created_at: string;
    students_count?: number;
    patients_count?: number;
}

export interface Student {
    id: number;
    user_id?: number;
    full_name?: string;
    student_name: string;
    email: string;
    phone?: string;
    phone_number?: string;
    college_institution?: string;
    roll_number?: string;
    enrollment_number: string;
    year_of_study?: string;
    department?: string;
    doctor_id?: number | null;
    doctor_name?: string | null;
    is_active?: boolean;
    account_status: string;
    revoked_at?: string | null;
    created_at: string;
    patients_count?: number;
}

export interface DateWiseXrayItem {
    id: number;
    patient_id: number;
    upload_date?: string;
    media_date?: string;
    created_at: string;
    xray_type?: string;
    document_type?: string;
    treatment_stage?: TreatmentStage;
    title?: string;
    description?: string;
    disease_category?: string;
    file_name: string;
    original_file_name: string;
    file_size: number;
    mime_type: string;
    is_shared_with_patient?: boolean;
    uploaded_by?: string;
    view_url: string;
    download_url: string;
}

export interface DentistProfile {
    id: number;
    user_id?: number;
    license_number: string;
    specialization: string;
    department?: string;
    qualifications?: string;
    cabin_number?: string;
    cabin_operatory?: string;
    is_admin?: boolean;
    is_active?: boolean;
}

export interface User {
    id: number;
    email: string;
    username: string;
    full_name: string;
    role: Role;
    is_admin?: boolean;
    preferred_language?: LanguageCode;
    phone?: string;
    patient_id?: number;
    doctor_id?: number;
    student_id?: number;
    is_active: boolean;
    created_at: string;
    dentist_profile?: DentistProfile;
}

export interface MedicalHistory {
    id?: number;
    patient_id?: number;
    allergies?: string;
    medical_conditions?: string;
    current_medications?: string;
    past_surgeries?: string;
    bleeding_disorders: boolean;
    is_pregnant: boolean;
    notes?: string;
    updated_at?: string;
}

export interface DentalHistory {
    id?: number;
    patient_id?: number;
    chief_complaint?: string;
    past_dental_treatments?: string;
    brushing_frequency?: string;
    flossing: boolean;
    habits?: string;
    dental_anxiety_level?: string;
    notes?: string;
    updated_at?: string;
}

export interface SharedNotice {
    id: string | number;
    title: string;
    notice_type: 'test_scan' | 'instruction' | 'general';
    message: string;
    description?: string;
    due_date?: string;
    target_date?: string;
    is_resolved?: boolean;
    language?: LanguageCode;
    created_by?: string;
    created_at: string;
}

export interface Patient {
    id: number;
    patient_code: string;
    cr_number?: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    patient_name?: string;
    date_of_birth: string;
    age?: number;
    gender: 'Male' | 'Female' | 'Other';
    phone: string;
    email?: string;
    address?: string;
    emergency_contact?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    blood_group?: string;
    preferred_language?: LanguageCode;
    doctor_id?: number | null;
    doctor_name?: string;
    student_id?: number | null;
    student_name?: string;
    disease_categories?: string[];
    case_keywords?: string[];
    special_case_flag?: boolean;
    pain_scale?: number;
    severity_level?: SeverityLevel;
    parent_consent_required?: boolean;
    parent_guardian_name?: string;
    parent_guardian_phone?: string;
    parent_consent_status?: 'not_required' | 'pending' | 'signed';
    parent_consent_doc_id?: number | null;
    card_doc_id?: number | null;
    patient_card_document?: string;
    card_verification_status?: string;
    attendance_status?: string;
    tracker_stage?: TrackerStage;
    source_channel?: string;
    account_status?: string;
    created_at: string;
    updated_at?: string;
    medical_history?: MedicalHistory;
    dental_history?: DentalHistory;
    misc_records_json?: Record<string, string>;
    patient_shared_notices_json?: SharedNotice[];
}

export interface AppointmentType {
    id: number;
    name: string;
    duration_minutes: number;
    color_code: string;
}

export type AppointmentStatus =
    | 'scheduled'
    | 'confirmed'
    | 'checked_in'
    | 'in_progress'
    | 'in_treatment'
    | 'completed'
    | 'cancelled'
    | 'no_show';

export interface Appointment {
    id: number;
    patient_id: number;
    dentist_id?: number;
    doctor_id?: number;
    student_id?: number | null;
    operatory?: string;
    appointment_type_id?: number;
    appointment_type?: string | AppointmentType;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: AppointmentStatus;
    attendance_status?: 'pending' | 'checked_in' | 'present' | 'completed' | 'missed';
    is_missed?: boolean;
    missed_reason?: string;
    google_event_id?: string | null;
    google_calendar_url?: string;
    reason?: string;
    cancellation_reason?: string;
    notes?: string;
    created_at: string;
    patient_name?: string;
    patient_code?: string;
    cr_number?: string;
    dentist_name?: string;
    doctor_name?: string;
    appointment_type_name?: string;
    patient?: any;
    dentist?: any;
}

export interface Visit {
    id: number;
    patient_id: number;
    dentist_id?: number;
    doctor_id?: number;
    appointment_id?: number;
    visit_date: string;
    vitals_blood_pressure?: string;
    vitals_pulse?: number;
    chief_complaint?: string;
    general_exam_notes?: string;
    extraoral_findings?: string;
    tmj_status?: string;
    lymph_nodes?: string;
    intraoral_hard_tissue?: string;
    intraoral_soft_tissue?: string;
    occlusion_status?: string;
    oral_findings?: string;
    gum_condition?: string;
    hygiene_index?: string;
    pain_scale?: number;
    severity_level?: SeverityLevel;
    diagnosis?: string;
    clinical_notes?: string;
    is_visible_to_patient?: boolean;
    created_at: string;
    dentist_name?: string;
    doctor_name?: string;
    patient_name?: string;
}

export type ToothConditionType =
    | 'healthy'
    | 'caries'
    | 'missing'
    | 'filled'
    | 'crown'
    | 'root_canal'
    | 'extraction'
    | 'fracture'
    | 'sensitivity'
    | 'mobility'
    | 'bridge'
    | 'implant'
    | 'impacted'
    | 'other';

export interface ToothCondition {
    id: number;
    patient_id: number;
    tooth_number: number;
    current_condition: ToothConditionType;
    condition?: ToothConditionType;
    severity?: 'none' | 'mild' | 'moderate' | 'severe';
    surfaces?: string;
    notes?: string;
    updated_at: string;
}

export interface ToothHistory {
    id: number;
    patient_id: number;
    visit_id?: number;
    dentist_id: number;
    dentist_name?: string;
    tooth_number: number;
    condition: ToothConditionType;
    severity?: string;
    surfaces?: string;
    notes?: string;
    created_at: string;
}

export interface DentalChartDetail {
    patient_id: number;
    teeth: Record<number, ToothCondition>;
    history: ToothHistory[];
}

export interface PerioSites {
    MB: number;
    B: number;
    DB: number;
    ML: number;
    L: number;
    DL: number;
}

export interface PerioToothData {
    tooth_number: number;
    probing_depths: PerioSites;
    recession: PerioSites;
    bop: boolean;
    mobility: '0' | 'I' | 'II' | 'III';
    furcation: '0' | 'I' | 'II' | 'III';
    plaque_index: number;
    notes?: string;
}

export interface PerioChart {
    patient_id: number;
    teeth: Record<number, PerioToothData>;
    mean_ppd?: number;
    bop_percentage?: number;
    deepest_pocket?: number;
    sites_ge_4mm?: number;
    updated_at?: string;
    notes?: string;
}

export interface ProcedureCatalog {
    id: number;
    code: string;
    name: string;
    category: string;
    estimated_duration_minutes?: number;
    description?: string;
}

export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface TreatmentItem {
    id: number;
    treatment_plan_id: number;
    procedure_name: string;
    tooth_number?: number;
    status: TreatmentStatus;
    visit_id?: number;
    notes?: string;
    completed_at?: string;
    created_at: string;
}

export interface TreatmentPlan {
    id: number;
    patient_id: number;
    dentist_id?: number;
    doctor_id?: number;
    title: string;
    status: 'draft' | 'active' | 'completed' | 'cancelled';
    notes?: string;
    created_at: string;
    updated_at: string;
    dentist_name?: string;
    doctor_name?: string;
    patient_name?: string;
    treatments: TreatmentItem[];
    items?: TreatmentItem[];
}

export interface SurgicalLog {
    id: number;
    patient_id: number;
    surgery_date: string;
    procedure_name: string;
    tooth_numbers?: string;
    surgeon_name?: string;
    anesthesia_type?: string;
    operative_notes?: string;
    post_op_instructions?: string;
    suture_removal_date?: string;
    linked_document_ids?: number[];
    created_at: string;
}

export interface MedicineCatalog {
    id: number;
    name: string;
    generic_name?: string;
    dosage_form: string;
    default_dosage?: string;
    instructions?: string;
}

export interface PrescriptionItem {
    id?: number;
    medicine_name: string;
    drug_name?: string;
    dosage: string;
    frequency: string;
    duration: string;
    duration_days?: number;
    timing: string;
    instructions?: string;
    localized_instructions?: string;
}

export interface PrescriptionTemplate {
    id: number;
    template_name: string;
    diagnosis_summary?: string;
    general_instructions?: string;
    language?: LanguageCode;
    items: PrescriptionItem[];
}

export interface TreatmentInstructionTemplate {
    key: string;
    category: 'pre_appointment' | 'post_treatment';
    title: string;
    language: LanguageCode;
    content: string;
}

export interface Prescription {
    id: number;
    prescription_number: string;
    patient_id: number;
    dentist_id?: number;
    doctor_id?: number;
    visit_id?: number;
    template_name?: string;
    language?: LanguageCode;
    diagnosis_summary?: string;
    general_instructions?: string;
    localized_summary?: string;
    treatment_instructions?: string;
    created_at: string;
    dentist_name?: string;
    doctor_name?: string;
    patient_name?: string;
    items: PrescriptionItem[];
}

export interface DocumentItem {
    id: number;
    patient_id: number;
    clinical_record_id?: number | null;
    visit_id?: number;
    document_type: string;
    title?: string;
    description?: string;
    disease_category?: string;
    treatment_stage?: TreatmentStage;
    media_date?: string;
    is_shared_with_patient?: boolean;
    file_name: string;
    original_file_name: string;
    file_size: number;
    file_size_bytes?: number;
    mime_type: string;
    sha256_checksum?: string;
    notes?: string;
    file_path?: string;
    upload_date?: string;
    created_at: string;
    patient_name?: string;
}

export interface FollowUp {
    id: number;
    patient_id: number;
    dentist_id?: number;
    doctor_id?: number;
    visit_id?: number;
    scheduled_date: string;
    reason: string;
    status: 'pending' | 'completed' | 'cancelled';
    notes?: string;
    created_at: string;
    patient_name?: string;
    dentist_name?: string;
}

export interface DashboardSummary {
    total_patients: number;
    new_patients_period: number;
    today_appointments: number;
    upcoming_appointments: number;
    pending_treatments: number;
    completed_treatments: number;
    followups_due: number;
}

export interface DashboardAnalytics {
    appointments_by_status: { status: string; count: number }[];
    treatments_by_procedure: { procedure_name: string; count: number }[];
    patients_trend: { date: string; new_patients: number }[];
}

export interface TrackerEnquiry {
    id: number;
    caller_name: string;
    phone: string;
    source_channel: 'phone_enquiry' | 'whatsapp' | 'instagram' | 'facebook' | 'referral' | 'walk_in';
    preferred_language: LanguageCode;
    chief_complaint?: string;
    followup_date?: string;
    notes?: string;
    stage: TrackerStage;
    status: string;
    assigned_doctor_id?: number | null;
    assigned_doctor_name?: string | null;
    assigned_student_id?: number | null;
    assigned_student_name?: string | null;
    converted_patient_id?: number | null;
    created_at: string;
    updated_at?: string;
}

export interface SlippingPatient {
    patient_id: number;
    cr_number?: string;
    patient_name: string;
    phone: string;
    reason: string;
    days_overdue: number;
    tracker_stage?: TrackerStage;
    last_contact_date?: string;
    doctor_name?: string;
    student_name?: string;
}

export interface TrackerOverview {
    stage_counts: Record<TrackerStage, number>;
    total_enquiries: number;
    slipping_count: number;
    converted_count: number;
}

export interface AttendanceItem {
    appointment_id: number;
    patient_id: number;
    cr_number?: string;
    patient_code: string;
    full_name: string;
    phone: string;
    doctor_name: string;
    operatory?: string;
    appointment_date: string;
    start_time: string;
    end_time?: string;
    attendance_status: 'pending' | 'checked_in' | 'present' | 'completed' | 'missed';
    notes?: string;
}

export interface NotificationLog {
    id: number;
    patient_id?: number;
    patient_name?: string;
    recipient: string;
    sender_id?: string;
    channel: 'sms' | 'email' | 'whatsapp';
    language: LanguageCode;
    category: string;
    title?: string;
    message_body: string;
    status: string;
    created_at: string;
}

export interface RecallItem {
    id: number;
    patient_id: number;
    patient_name: string;
    cr_number?: string;
    phone?: string;
    recall_type: 'regular_checkup' | 'suture_removal' | 'crown_check' | 'rct_followup' | 'perio_maintenance';
    scheduled_date: string;
    language: LanguageCode;
    status: string;
    message?: string;
}

export interface PreventiveCareMessage {
    patient_id: number;
    patient_name?: string;
    language: LanguageCode;
    matched_factors: string[];
    title: string;
    message_body: string;
}

export interface SocialSettings {
    sms_sender_id?: string;
    sms_provider?: string;
    whatsapp_number: string;
    instagram_url: string;
    facebook_url: string;
    youtube_url: string;
    webhook_token?: string;
}

export interface PatientPortalAppointment {
    id: number;
    appointment_date: string;
    start_time: string;
    end_time: string;
    operatory?: string;
    department?: string;
    doctor_display_name: string;
    appointment_type?: string;
    status: string;
    pre_appointment_instructions?: string;
    google_calendar_url?: string;
    ics_download_url?: string;
}

export interface PatientPortalPrescription {
    id: number;
    prescription_number: string;
    record_type?: 'prescription' | 'instruction' | 'preventive';
    doctor_display_name: string;
    language: LanguageCode;
    diagnosis_summary?: string;
    general_instructions?: string;
    localized_summary?: string;
    treatment_instructions?: string;
    created_at: string;
    items: PrescriptionItem[];
}

export interface PatientPortalSharedItems {
    notices: SharedNotice[];
    documents: DocumentItem[];
}

export interface AuditLogItem {
    id: number;
    user_id?: number;
    user_email?: string;
    action: string;
    entity_name?: string;
    entity_id?: string;
    details?: string;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}
