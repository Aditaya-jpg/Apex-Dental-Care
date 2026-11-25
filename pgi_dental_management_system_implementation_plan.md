# PGI Dental Management System — Repository Audit & Complete Implementation Plan

## 1. Repository Architecture & Audit Overview

### Current Tech Stack (Retained)
- **Backend:** FastAPI (`backend/app`), SQLAlchemy 2.0, Alembic, **SQLite (default local/viva demo)** & **MySQL 8.0 (`docker-compose.yml`)**, JWT auth (`pyjwt`, `bcrypt`), ReportLab PDF generation (`backend/app/pdf/generator.py`), `cryptography` (AES-256-GCM file encryption), Pytest (`backend/tests/`).
- **Frontend:** React 18 + TypeScript + Vite (`frontend/src`), Tailwind CSS, React Router v6, TanStack React Query, Lucide icons, Recharts, Three.js (`Oral3DViewer.tsx`), Vitest (`frontend/src/test/`), Playwright (`e2e/tests/`).

### Critical Existing Bugs & Security Gaps Discovered During Audit
1. **Role Lockout Bug (`doctor` vs `dentist`):** `POST /api/v1/doctors` assigns `User.role = "doctor"`, but `visits.py`, `prescriptions.py`, `treatments.py`, `dental_chart.py`, `appointments.py`, `followups.py`, `xrays.py`, `PatientDetail.tsx`, and `ToothModal.tsx` check `require_roles("dentist", "admin")` / `hasRole('dentist', 'admin')`, causing **403 Forbidden** and hidden UI actions for doctor accounts.
2. **Broken Dashboard Data Contracts (`Dashboard.tsx` vs `dashboard_service.py`):**
   - Frontend reads `adminData.doctor_patient_counts` (`students_count`) and `adminData.student_patient_counts`, while backend returns `doctor_wise_patients` (`student_count`) and `student_wise_patients`.
   - Frontend reads `doctorData.total_students`, `total_patients`, `patients_registered_directly`, `patients_assigned_to_students`, `students` (`student_name`), and `pending_followups` as a number, while backend returns `my_students_count`, `my_patients_count`, `direct_patients_count`, `assigned_patients_count`, `my_students` (`name`), and `pending_followups` as an array.
   - `dashboard_service.py` (`get_student_dashboard`) has a broken SQL join: `TreatmentItem.treatment_plan_id == Patient.id` instead of joining `TreatmentPlan`.
3. **Broken Patient Card Upload (`PatientFormModal.tsx` vs `patients.py`):** `PatientFormModal.tsx` submits `formData.append('card_file', cardFile)`, while `POST /api/v1/patients/{patient_id}/card` expects form field `file: UploadFile = File(...)`, resulting in HTTP 422.
4. **Inverted Registration RBAC (`Patients.tsx`):** `const canRegister = hasRole('admin', 'receptionist')` hides patient registration from Doctors and Students while exposing it to Receptionists.
5. **Doctor Visibility Over-Restriction (`patient_service.py`):** Doctors are currently filtered to `Patient.doctor_id == c_doc_id` (returning 403 on other patients), violating the requirement that **all doctors must be able to view records of ALL patients** regardless of doctor or student assignment.
6. **Student–Doctor Hard Coupling & Incomplete Revocation (`student.py`, `students.py`, `dependencies.py`):** Students are tightly coupled to a single doctor, and deleting/deactivating a student does not immediately invalidate existing JWT access tokens or cleanly preserve assigned patient records via `ON DELETE SET NULL`.
7. **Patient Portal Data Over-Exposure (`PatientXrays.tsx`, `documents.py`, `xrays.py`, `patients.py`):** No explicit opt-in sharing boundary separates internal doctor notes/records from patient-visible items (prescriptions, requested tests/scans to conduct & bring, next appointments, care instructions).
8. **Critical File Storage Vulnerabilities (`document_service.py`, `file_storage.py`):**
   - **IDOR Vulnerability:** `GET /api/v1/documents/{id}/download`, `GET /api/v1/documents`, and `GET /api/v1/documents/patient/{patient_id}` only check `get_current_user` — any logged-in student, receptionist, or patient can download any other patient's X-rays or clinical photographs by ID.
   - **Unencrypted Raw Files & Absolute Paths:** Files are written unencrypted to `backend/uploads/` and saved with hardcoded absolute paths.
   - **Client-Spoofable MIME Checks & Rigid 15 MB Cap:** Relies solely on browser `content_type` header and blocks large raw CBCT files (`.dcm` / `.nii` / `.zip`).
9. **Bloated & Duplicate Schema (18+ Tables):** Both `doctors` and `dentists` tables exist, alongside prohibited billing tables and fragmented sub-tables (`medical_histories`, `dental_histories`, `prescription_items`, `treatment_items`, `tooth_condition_histories`, `refresh_tokens`), plus SQLite-only `PRAGMA` statements in `backend/migrate_db.py`.

---

## 2. Gap Summary (Line-by-Line vs `product_requirements.md` & Final Decisions)

| Req # | Requirement Area | Status | Key Gaps |
| :--- | :--- | :--- | :--- |
| 1.1 | Multi-device access (desktop, tablet, mobile) | **Partial** | `MainLayout.tsx` + `Sidebar.tsx` use fixed `w-64` layout with no mobile drawer/hamburger toggle; tables and profile tabs overflow on mobile; branding still says "Apex Dental Care, Bengaluru". |
| 1.2 | No Payment Module (explicitly excluded) | **Violated** | `models/billing.py`, `routers/billing.py`, `routers/reports.py`, `services/billing_service.py`, `services/report_service.py`, `Billing.tsx`, `Reports.tsx`, `PatientInvoices.tsx`, `InvoiceModal.tsx`, fee/cost columns, and billing tests still exist. |
| 1.3 | Multilingual support (Hindi, English, Punjabi) | **Missing** | No language preference, no translated prescription/treatment/reminder templates, and ReportLab uses Helvetica (cannot render Devanagari or Gurmukhi Unicode). |
| 2.1 | Admin (Faculty / Designated Doctor) & Instant Student Revocation | **Partial** | Can manage doctors/students, but lacks "designated doctor as admin" flag (`is_admin`), lacks immediate JWT/session revocation when removing a student (by ID/email), and has broken Admin Dashboard bindings. |
| 2.2 | Doctors RBAC & Unrestricted All-Patient Visibility | **Partial / Buggy** | Role mismatch (`doctor` vs `dentist`), restricted from viewing patients assigned to other doctors/students, cannot register patients from UI, missing "Add missed patients" and pain/severity update on Doctor Dashboard. |
| 2.3 | Students RBAC (Flexible Pool + Strict Assigned-Patient Isolation) | **Partial / Buggy** | Students shouldn't be strictly bound to one doctor; cannot click "Register Patient" in UI; blocked from clinical EMR actions on assigned patients; must be strictly blocked (`403`) from seeing ANY patient or treatment record not assigned to them. |
| 2.4 | Receptionist (attendance only) | **Violated** | Currently allowed to create/edit patients, upload documents, manage follow-ups, and access full scheduling instead of **patient attendance only**. |
| 2.5 | Patient Portal Privacy & Opt-In Doctor Sharing | **Missing / Violated** | No strict barrier hiding doctor details, clinical notes, exams, charts, and unshared scans from patients; missing explicit doctor-to-patient sharing for **prescriptions, requested tests/scans to conduct & bring, next appointments, and care instructions**. |
| 3.1 | Patient card upload & CR Number | **Partial / Buggy** | Form field mismatch (`card_file` vs `file`); CR Number and card preview not prominently displayed on `Patients.tsx` and `PatientDetail.tsx`. |
| 3.2 | Parent's consent (minors / special cases) | **Missing** | No guardian/parent consent fields, checkbox/status, or dedicated consent upload & preview on patient profile. |
| 3.3 | Multi-select disease categories + keyword segregation | **Partial** | Multi-select checkboxes exist in creation modal only; missing category filter matrix in directory, missing keyword tags (age group, special case, custom keywords) & filtering. |
| 3.4 | Patient Tracker (telephonic enquiries & slipping patients) | **Missing** | No enquiry logging, stage funnel tracking, or slipping/drop-off patient dashboard. |
| 4.1 | EMR: Priority Demographics & Illness History | **Partial** | Demographics buried in compact header; needs priority top card with CR No, Guardian/Consent, Assigned Doctor/Student, Pain/Severity badge. |
| 4.2 | EMR: General & Intraoral Examinations | **Partial** | Visits lack structured General Exam (extraoral, TMJ, lymph nodes, systemic signs) vs Intraoral Exam (hard/soft tissue, mucosa, occlusion) fields. |
| 4.3 | EMR: Clinical Notes & Adjustable Pain Scale / Severity | **Missing** | No 0–10 Pain Scale on visits/patients and no adjustable patient severity level (Mild/Moderate/Severe/Critical). |
| 4.4 | EMR: Restorative + Perio Charting | **Partial** | FDI restorative charting exists (`FDIToothChart.tsx`), but **Periodontal (Perio) Charting** (probing depths, BOP, recession, mobility, furcation) is completely missing. |
| 4.5 | EMR: Diagnosis, Treatment Plans & Date-Wise Surgical Logs | **Partial** | Treatment plans exist (with extraneous billing costs), but **date-wise surgical treatment logs** (surgery date, procedure, anesthesia, operative notes, sutures, linked surgery photos) are missing. |
| 4.6 | EMR: Separate Prescriptions (Auto-Rx, Templates, Localized) | **Partial** | Separate tab/page exists, but lacks **Auto-Prescription / Templates** and **EN/HI/PA localized instructions**. |
| 4.7 | EMR: Treatment Instructions, Follow-ups, Miscellaneous | **Partial** | Follow-ups exist; **Treatment Instructions** library/dispatch and **Category-specific Miscellaneous records** are missing. |
| 5.1 | Media: X-rays, OPG, CBCT (2D + Raw 3D) + 6 Photo Types | **Partial** | Missing explicit photo categories (`intraoral_photo`, `extraoral_photo`, `iop_photo`, `profile_photo`, `surgery_photo`, `misc_photo`) and flexible raw CBCT support (`.dcm`, `.nii`, `.nii.gz`, `.zip`, `.glb`, plus 2D images/PDFs). |
| 5.2 | Media: Secure Storage, Date-Wise, Stages & Disease X-Ray Links | **Partial / Insecure** | IDOR download bug; unencrypted disk storage; missing `media_date`, `treatment_stage`, `disease_category`, `is_shared_with_patient`, and clickable date-wise X-ray hyperlinks under each disease category. |
| 6.1 | Smart Calendar (Doctor-wise & Operatory-wise views) | **Missing** | `Appointments.tsx` is a flat list; no operatory/chair field and no Doctor-wise / Operatory-wise calendar grid. |
| 6.2 | Google Calendar Integration (Doctors & Patients) | **Missing** | No Google Calendar API sync, `.ics` export, or "Add to Google Calendar" sync links/status. |
| 6.3 | Missed Appointments from Doctor Page | **Missing** | No "Add Missed Patient / Missed Appointment" modal or tracker on Doctor Dashboard. |
| 7.1 | SMS & Email Alerts + Custom SMS Sender ID | **Missing** | No notification service, no `SMS_SENDER_ID`, no automated triggers on confirm/change/cancel, no delivery log. |
| 7.2 | Automated Pre-appointment & Post-treatment Instructions | **Missing** | No instruction templates or automatic dispatch on booking/treatment completion. |
| 7.3 | Automatic Recalls (Regular Check-up & Treatment-Specific) | **Missing** | No recall rules engine or automated recall scheduling/dispatch. |
| 7.4 | Preventive Care Messaging (Demographics / Conditions / Habits) | **Missing** | No rule engine generating/sending preventive care messages by age, medical/dental conditions, or habits. |
| 7.5 | Social Media Integration | **Missing** | No WhatsApp/Facebook/Instagram clinic channel hub, shareable patient care links, or social lead capture into Patient Tracker. |
| 8.1 | Lightweight Database Constraint (Strictly 8 Tables: 3 Core + 5 Supporting) | **Conflict** | Currently 18+ tables including duplicate `dentists` + `doctors` and prohibited billing tables. Consolidate to **exactly 8 clean tables**. |

---

## 3. Step-by-Step Implementation Plan

### Phase 1: 8-Table Schema Consolidation, Billing Removal, Secure Storage & PGI Branding

#### 1.1 Remove All Payment & Billing Modules (Req 1.2)
- **Delete backend files:**
  - `backend/app/models/billing.py`
  - `backend/app/schemas/billing.py`
  - `backend/app/services/billing_service.py`
  - `backend/app/services/report_service.py`
  - `backend/app/routers/billing.py`
  - `backend/app/routers/reports.py`
  - `backend/tests/test_billing.py`
- **Modify backend files:**
  - `backend/app/main.py`: Remove `billing` and `reports` router imports and `app.include_router(...)` calls.
  - `backend/app/models/__init__.py` & `backend/app/schemas/__init__.py`: Remove `Invoice`, `InvoiceItem`, and billing schema exports.
  - `backend/app/schemas/treatment.py`, `backend/app/services/treatment_service.py`: Remove cost/fee fields (`default_cost`, `estimated_cost`, `actual_cost`, `estimated_total`).
  - `backend/app/schemas/appointment.py`: Remove `default_fee`.
  - `backend/app/schemas/dashboard.py` & `backend/app/services/dashboard_service.py`: Remove `total_revenue`, `outstanding_payments`, `RevenueTrendPoint`, and `revenue_trend`.
  - `backend/app/services/patient_service.py`: Remove `invoice` event generation in `get_patient_timeline`.
  - `backend/app/pdf/generator.py`: Remove `generate_invoice_pdf` (if present); retain only clinical/prescription PDFs.
  - `backend/app/security/permissions.py`: Remove `BILLING_READ` and `BILLING_MANAGE`.
- **Delete frontend files:**
  - `frontend/src/pages/Billing.tsx`
  - `frontend/src/pages/Reports.tsx`
  - `frontend/src/pages/patient/PatientInvoices.tsx`
  - `frontend/src/components/billing/InvoiceModal.tsx`
  - `frontend/src/api/billing.ts`
  - `frontend/src/api/reports.ts`
  - `e2e/tests/workflow_3_billing_payment.spec.ts`
- **Modify frontend files:**
  - `frontend/src/types/index.ts`: Remove `Invoice`, `InvoiceItem`, `Payment`, `PaymentStatus`, `PaymentOrderResponse`, `PaymentVerifyResponse`, and cost/revenue fields from `TreatmentPlan`, `TreatmentItem`, `ProcedureCatalog`, `AppointmentType`, `DashboardSummary`, `DashboardAnalytics`.
  - `frontend/src/pages/Treatments.tsx` & `frontend/src/components/treatments/TreatmentPlanModal.tsx`: Remove all ₹/cost inputs, totals, and fee displays.
  - `frontend/src/pages/PatientDetail.tsx` & `frontend/src/pages/Dashboard.tsx`: Remove all cost/revenue badges and charts.

#### 1.2 Exact 8-Table Database Schema (3 Core Entity Tables + 5 Supporting Operational Tables)
Keep the existing **SQLite (default local/viva) + MySQL 8.0 (`docker-compose.yml`)** stack using portable SQLAlchemy 2.0 `JSON` columns (no PostgreSQL-only types and no SQLite-only raw `PRAGMA` migrations). Delete redundant model files (`billing.py`, duplicate `Dentist`, `MedicalHistory`, `DentalHistory`, `RefreshToken`, `TreatmentItem`, `PrescriptionItem`, `ToothConditionHistory`, `ProcedureCatalog`, `AppointmentType` tables — replace static procedure/appointment type catalogs with clean Python constants/config) so `Base.metadata.tables` has **exactly 8 tables**:

**Tier 1 — 3 Primary Core Tables:**
1. **`doctors`** (`backend/app/models/doctor.py`)
   - Replaces duplicate `dentists` table completely.
   - Columns: `id` (PK), `user_id` (FK -> `users.id`, unique), `full_name`, `email` (unique), `phone`, `specialization`, `department`, `license_number`, `cabin_operatory` (default `"Operatory 1"`), `is_admin` (Boolean, default `False` — supports designated faculty doctor as Admin), `google_calendar_id` (nullable), `google_oauth_tokens` (JSON, nullable), `is_active` (Boolean, default `True`), `created_at`, `updated_at`.
2. **`students`** (`backend/app/models/student.py`)
   - Single unified table for all students across the branch.
   - Columns: `id` (PK), `user_id` (FK -> `users.id`, unique), **`doctor_id` (FK -> `doctors.id`, `nullable=True`, `ondelete="SET NULL"`)** (students are **not strictly locked to a specific doctor**; optional mentor reference only), `full_name`, `email` (unique), `phone`, `roll_number`, `year_of_study`, `department`, `is_active` (Boolean, default `True`), `revoked_at` (DateTime, nullable), `created_at`, `updated_at`.
3. **`patients`** (`backend/app/models/patient.py`)
   - Foreign keys: `user_id` (FK -> `users.id`, nullable, unique — for patient portal login), `doctor_id` (FK -> `doctors.id`, `nullable=True`, `ondelete="SET NULL"`), `student_id` (FK -> `students.id`, `nullable=True`, `ondelete="SET NULL"` — guarantees removing a student never deletes patient records).
   - Core Demographics & Registration: `id`, `patient_code` (unique), `cr_number` (unique, indexed), `full_name`, `date_of_birth`, `age`, `gender`, `phone`, `email`, `address`, `blood_group`, `emergency_contact`, `preferred_language` (`en | hi | pa`, default `en`).
   - Categorization, Triage & Consent: `disease_categories` (JSON list), `case_keywords` (JSON list — e.g., `["pediatric", "special_case", "diabetes"]`), `special_case_flag` (Boolean), `pain_scale` (Integer 0–10, default 0), `severity_level` (`none | mild | moderate | severe | critical`, default `none`), `parent_consent_required` (Boolean), `parent_guardian_name`, `parent_guardian_phone`, `parent_consent_status` (`not_required | pending | signed`), `parent_consent_doc_id` (Integer, nullable), `card_doc_id` (Integer, nullable).
   - 1-to-1 Structured Clinical JSON Columns:
     - `medical_history_json` (JSON — systemic illnesses, allergies, medications, habits like smoking/tobacco/bruxism)
     - `dental_history_json` (JSON — past dental visits, brushing habits, chief dental history)
     - `dental_chart_json` (JSON — 32-tooth FDI restorative chart + per-tooth condition history)
     - `perio_chart_json` (JSON — 32-tooth 6-site periodontal chart: MB/B/DB/ML/L/DL probing depths, recession, BOP, mobility, furcation, plaque index + timestamped snapshots)
     - `misc_records_json` (JSON dict keyed by disease category — category-specific miscellaneous notes)
     - `patient_shared_notices_json` (JSON list — explicit doctor-approved advisories for the patient, such as **tests/scans to conduct and bring** and special pre/post care instructions)
   - Tracking & Attendance: `attendance_status` (`not_arrived | checked_in | in_treatment | completed | missed`), `last_attendance_at`, `tracker_stage` (`enquiry | registered | diagnosed | in_treatment | followup | slipping | completed`), `source_channel` (`walk_in | phone_enquiry | whatsapp | instagram | facebook | referral`), `created_at`, `updated_at`.

**Tier 2 — 5 Lean Supporting Operational Tables:**
4. **`users`** (`backend/app/models/user.py`)
   - Unified authentication & instant revocation for all 5 roles (`admin`, `doctor`, `student`, `receptionist`, `patient`).
   - Columns: `id`, `email` (unique, indexed), `password_hash`, `full_name`, `role` (indexed), `is_active` (Boolean, default `True`), **`token_version`** (Integer, default `1` — embedded as `tv` claim in JWT; incrementing instantly invalidates all active tokens), `refresh_tokens_json` (JSON list of active hashed refresh tokens with expiry — replaces separate `refresh_tokens` table), `revoked_at` (DateTime, nullable), `last_login_at`, `created_at`, `updated_at`.
5. **`appointments`** (`backend/app/models/appointment.py`)
   - Dedicated indexed table for Smart Calendar (Doctor-wise & Operatory-wise views), conflict locking, Receptionist attendance, Missed Appointments, and Google Calendar sync.
   - Columns: `id`, `patient_id` (FK -> `patients.id`, indexed), `doctor_id` (FK -> `doctors.id`, indexed), `student_id` (FK -> `students.id`, `nullable=True`, `ondelete="SET NULL"`), `operatory` (String, indexed, e.g., `"Operatory 1"`), `appointment_type` (String), `appointment_date` (Date, indexed), `start_time` (Time), `end_time` (Time), `status` (`scheduled | confirmed | checked_in | in_treatment | completed | cancelled | no_show`), `attendance_status` (`pending | checked_in | present | completed | missed`), `attendance_marked_at` (DateTime, nullable), `attendance_marked_by` (Integer, nullable), `is_missed` (Boolean, default `False`), `missed_reason` (Text, nullable), `google_event_id` (String, nullable), `notes` (Text, nullable — internal), `created_at`, `updated_at`.
6. **`clinical_records`** (`backend/app/models/clinical_record.py`)
   - Unified chronological EMR records table cleanly separating clinical events while keeping table count minimal.
   - Columns: `id`, `patient_id` (FK -> `patients.id`, indexed), `doctor_id` (FK -> `doctors.id`, `nullable=True`, `ondelete="SET NULL"`), `student_id` (FK -> `students.id`, `nullable=True`, `ondelete="SET NULL"`), `appointment_id` (FK -> `appointments.id`, `nullable=True`, `ondelete="SET NULL"`), **`record_type`** (indexed: `visit | treatment_plan | surgical_log | prescription | rx_template`), `record_date` (Date, indexed), `title` (String), `status` (String), `language` (`en | hi | pa`, default `en`), **`is_visible_to_patient`** (Boolean, default `False` — `True` ONLY for issued `prescription` records and explicitly shared treatment instructions; ALWAYS `False` for `visit`, `treatment_plan`, and `surgical_log`), `payload_json` (JSON), `created_at`, `updated_at`.
   - **`payload_json` shapes by `record_type`:**
     - `visit`: vitals, `general_exam_notes`, `extraoral_findings`, `tmj_status`, `lymph_nodes`, `intraoral_hard_tissue`, `intraoral_soft_tissue`, `occlusion_status`, `chief_complaint`, `diagnosis`, `clinical_notes`, `pain_scale`, `severity_level`.
     - `treatment_plan`: diagnosis summary, `items` array (`id`, `tooth_number`, `procedure_name`, `status`, `notes`, `completed_at` — zero billing/cost fields).
     - `surgical_log`: `procedure_name`, `tooth_numbers`, `surgeon_name`, `anesthesia_type`, `operative_notes`, `post_op_instructions`, `suture_removal_date`, `linked_document_ids`.
     - `prescription`: `prescription_number`, `template_name`, `medications` array (`drug_name`, `dosage`, `frequency`, `timing`, `duration`, `instructions`, `localized_instructions`), `treatment_instructions`, `localized_summary`.
     - `rx_template` (`patient_id=NULL`): reusable Auto-Prescription templates (Acute Pulpitis, Post-Extraction, Periodontal Infection, Dental Abscess, Aphthous Ulcer, Pediatric Pain Relief).
7. **`documents`** (`backend/app/models/document.py`)
   - Metadata for all imaging, clinical photography, cards, and consent files (never stores binary BLOBs in SQL).
   - Columns: `id`, `patient_id` (FK -> `patients.id`, indexed), `clinical_record_id` (FK -> `clinical_records.id`, `nullable=True`, `ondelete="SET NULL"` — links surgery photos to surgical logs), `uploaded_by_user_id` (FK -> `users.id`), `document_type` (indexed: `xray | opg | cbct | intraoral_photo | extraoral_photo | iop_photo | profile_photo | surgery_photo | misc_photo | patient_card | parent_consent | lab_report | other`), `title`, `description`, `disease_category` (String, indexed, nullable), `treatment_stage` (`initial_assessment | pre_treatment | mid_treatment | surgery | post_treatment | follow_up`, default `initial_assessment`), `media_date` (Date, indexed), **`is_shared_with_patient`** (Boolean, default `False` — strict opt-in privacy toggle), `storage_key` (String — relative key only, never absolute path), `original_filename`, `mime_type`, `file_size_bytes` (BigInteger — supports large raw CBCT files), `is_encrypted` (Boolean, default `True`), `encryption_iv` (String, nullable), `sha256_checksum` (String), `created_at`.
8. **`care_and_system_logs`** (`backend/app/models/care_log.py`)
   - Unified operational log & tracker table keeping total DB tables strictly at 8.
   - Columns: `id`, **`event_type`** (indexed: `enquiry | followup | recall | notification | audit | clinic_config`), `patient_id` (FK -> `patients.id`, `nullable=True`, indexed), `actor_user_id` (FK -> `users.id`, `nullable=True`), `assigned_doctor_id` (FK -> `doctors.id`, `nullable=True`), `assigned_student_id` (FK -> `students.id`, `nullable=True`), `status` (indexed: e.g., `open | contacted | converted | pending | sent_sandbox | completed | skipped`), `scheduled_date` (Date, indexed, nullable), `channel` (`phone | sms | email | whatsapp | instagram | facebook | system`), `language` (`en | hi | pa`, default `en`), `title`, `payload_json` (JSON — holds enquiry details, recall type/rule, SMS `sender_id` & message body, audit IP/action/diff, or clinic settings like `sms_sender_id` and social media URLs), `created_at`, `updated_at`.

- **Migration & Seed Strategy:**
  - Replace the SQLite-only `PRAGMA` logic in `backend/migrate_db.py` with a clean schema initializer + Alembic migration (`001_pgi_8_table_schema.py`) compatible with both SQLite and MySQL 8.0.
  - Update `backend/seeds/seed_data.py` with realistic **PGI Dental Branch (PGIMER Chandigarh)** seed data: 1 Faculty Admin Doctor, 3 Doctors across operatories, 6 Dental Students (flexible pool — not locked to one doctor), 1 Receptionist, 15+ Patients (5 assigned to Student 1, 5 assigned to Student 2, plus unassigned/doctor-only patients) with CR numbers, disease categories, keywords, encrypted sample X-rays/OPG/CBCT & clinical photos (only selected items marked `is_shared_with_patient=True`), perio & restorative charts, surgical logs, doctor-shared test/scan requests, missed appointments, telephonic enquiries, and 6 Auto-Rx templates.

#### 1.3 Secure & Flexible File Storage Architecture (Req 5.1, 5.2)
- **Files:** `backend/app/storage/file_storage.py`, `backend/app/config.py`, `backend/app/services/document_service.py`, `backend/app/routers/documents.py`, `backend/app/routers/xrays.py`.
- **Storage Backend Abstraction (`StorageBackend`):**
  - **Default for Viva Demo (`STORAGE_TYPE=local_encrypted`):** Easy local storage in `backend/uploads/vault/{patient_id}/{uuid}.enc` using **AES-256-GCM encryption at rest** (key read from `FILE_ENCRYPTION_KEY` in `.env`, auto-generating a persistent local `.vault.key` dev fallback if unset so the viva demo starts with zero friction while files on disk remain encrypted).
  - **Production / PGI Upgrade Hook (`STORAGE_TYPE=s3`):** Drop-in S3-compatible provider interface (MinIO on PGI server / AWS S3 / Cloudflare R2) using the exact same relative `storage_key` — zero DB migration required when moving from viva demo to hospital server.
  - Never expose `backend/uploads/` via static file serving in FastAPI or Nginx.
- **Flexible Format & Size Support (2D Screenshots + Full Raw CBCT Files):**
  - **Allowed Formats:**
    - 2D Images & Scans: `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tif`, `.tiff`
    - Documents: `.pdf`
    - Full Raw 3D / CBCT & Volumes: `.dcm` / `.dicom`, `.nii`, `.nii.gz`, `.zip`, `.rar`, `.stl`, `.obj`, `.glb`
  - **Tiered Size Limits (configurable in `.env`):**
    - Standard images/photos/X-rays/PDFs: up to `25 MB`.
    - `cbct` uploads: up to `500 MB` via **chunked streaming I/O** (reads/encrypts/streams in 1 MB chunks so large raw CBCT files never spike RAM).
  - **Magic-Byte Validation & Checksums:** Validate file headers (PNG/JPEG/PDF/ZIP/DICOM `DICM`/GZIP) instead of trusting browser `Content-Type`; compute and store `sha256_checksum`; reject executable/script uploads (`.exe`, `.sh`, `.html`, `.js`, `.svg`).
  - **Frontend Viewing Behavior:** 2D images & PDFs render inline in a secure lightbox viewer (fetched with Bearer JWT blob URL); raw 3D `.glb` opens in `Oral3DViewer.tsx`; raw `.dcm` / `.nii` / `.zip` CBCT archives display file metadata (size, checksum, date, stage) with a secure authenticated download button.
- **Fix Critical IDOR Bug (Strict Download Authorization Gate):**
  - Every `GET /api/v1/documents/{id}/download`, `GET /api/v1/documents`, `GET /api/v1/documents/patient/{patient_id}`, and `xrays.py` endpoint MUST enforce:
    - `admin` / `doctor` → Full access across all patients.
    - `student` → Allowed ONLY if `patient.student_id == current_student.id`; otherwise `403 Forbidden`.
    - `patient` → Allowed ONLY if `document.patient_id == current_user_patient.id` AND `document.is_shared_with_patient == True`; otherwise `403 Forbidden`.
    - `receptionist` → Always `403 Forbidden`.
  - Log every upload and download as an `audit` row in `care_and_system_logs`.

#### 1.4 PGI Dental Branch Rebranding
- Update `backend/app/config.py`: `CLINIC_NAME = "PGI Dental Branch — Oral Health Sciences Centre"`, Chandigarh address/contact, `SMS_SENDER_ID = "PGIDNT"`.
- Update `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/components/layout/PatientLayout.tsx`, and `frontend/index.html` title to **PGI Dental Management System**.

---

### Phase 2: RBAC Overhaul, Immediate Student Revocation & Patient Privacy (Req 2)

#### 2.1 Unify Roles & Enforce Strict Permission Matrix
- **Files:** `backend/app/security/permissions.py`, `backend/app/security/dependencies.py`, `backend/app/security/tokens.py`, all `backend/app/routers/*.py`, `backend/app/services/patient_service.py`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`.
- Standardize role checks across every backend router to accept `"doctor"` alongside `"dentist"` (migrating seeded/existing `dentist` users to `doctor`).
- Create a single shared guard `verify_patient_access(db, current_user, patient_id)` used by **every** patient, visit, chart, treatment, surgical log, prescription, document, followup, and appointment endpoint.
- **Role capabilities enforcement:**
  1. **Admin (Faculty / Designated Doctor):**
     - Full CRUD on `doctors` (including toggling `is_admin` to designate a doctor as Admin) and `students`.
     - **Remove & Revoke Student Access (Immediate):**
       - Provide `DELETE /api/v1/students/{student_id}` AND `DELETE /api/v1/students/by-email/{email}` (plus `POST /api/v1/students/{student_id}/revoke`) for Admin.
       - When Admin removes a student:
         1. Unassigns `patients.student_id = NULL` (preserving all patient medical records safely).
         2. Marks/removes the student from `students` and sets linked `User.is_active = False`, increments `User.token_version += 1`, clears `User.refresh_tokens_json = []`, sets `revoked_at = now()`, scrubs/marks email revoked so login is permanently rejected, and writes an `audit` log entry.
         3. **Hard Runtime Guard in `get_current_user` (`backend/app/security/dependencies.py`):** On EVERY authenticated request, verify `user is not None`, `user.is_active is True`, `payload.get("tv") == user.token_version`, and (if `user.role == "student"`) confirm an active matching row exists in `students`. If removed, immediately return `401 Unauthorized` ("Account access has been revoked") — even if the student holds a previously valid unexpired JWT.
     - Full read/write across patients, appointments, EMR, tracker, notifications, and audit logs.
  2. **Doctor (`doctor`):**
     - **Unrestricted Cross-Branch Patient Visibility:** Every doctor MUST be able to view and access **ALL** patient records across the entire PGI Dental branch — whether the patient is assigned to them, assigned to another doctor, assigned to their student, assigned to another student, or unassigned (`patient_service.py`: remove all `Patient.doctor_id == c_doc_id` blocks; support optional `scope=all|mine` defaulting to `all`).
     - Register, add, update, and delete Students on the single `students` table (`backend/app/routers/students.py`) — with `doctor_id` optional so students are not bound exclusively to one doctor.
     - Add/edit Patients (`Patients.tsx` + `patients.py`) and assign/reassign any patient to any active Student.
     - Record visits, dental/perio charts, surgical logs, treatments, prescriptions, media, missed patients, update pain/severity levels, and explicitly share prescriptions / test & scan requests / selected files with patients.
  3. **Student (`student`):**
     - **Flexible Supervision:** Not strictly tied to a single doctor (`students.doctor_id` nullable/optional).
     - **Strict Assigned-Patient-Only Isolation:**
       - A student can ONLY view and manage patients explicitly assigned to them (`Patient.student_id == current_student.id`).
       - A student MUST NEVER see details, names, appointments, visits, charts, treatments, surgical logs, prescriptions, documents/X-rays, follow-ups, or tracker entries of ANY other patient (whether unassigned, assigned to another student, or assigned only to a doctor). Direct ID access returns `403 Forbidden`.
       - When a student registers a new patient (`POST /api/v1/patients`), auto-assign `student_id = current_student.id` (and optional `doctor_id`).
  4. **Receptionist (`receptionist`) — Attendance Only:**
     - **Strict RBAC restriction:** Update `ROLE_PERMISSIONS[Role.RECEPTIONIST]` to ONLY allow `ATTENDANCE_MANAGE` and minimal appointment/attendance lookup (`id`, `cr_number`, `patient_code`, `full_name`, `phone`, `doctor_name`, `appointment_date`, `start_time`, `attendance_status`).
     - Block Receptionist with `403 Forbidden` on `POST /patients`, `PUT /patients`, clinical EMR tabs, visits, charting, prescriptions, documents, and follow-ups.
     - Create dedicated **`/attendance`** route & page (`frontend/src/pages/Attendance.tsx`) and backend endpoints:
       - `GET /api/v1/attendance/today?date=YYYY-MM-DD`
       - `PATCH /api/v1/attendance/{appointment_id}/mark` (payload: `{ status: "checked_in" | "present" | "missed" | "completed", notes?: string }`)
       - `POST /api/v1/attendance/walkin-checkin` (marks attendance for a registered patient by CR Number / Patient Code).
     - In `Sidebar.tsx`, Receptionist sees ONLY **Attendance** and redirects to `/attendance` on login.
  5. **Patient (`patient`) — Strict Clinical Privacy & Opt-In Doctor Sharing Only:**
     - **Strictly Blocked (`403 Forbidden` / Never Returned in Payloads):**
       - Doctor personal details (phone, email, staff directory, student assignment details, internal doctor notes).
       - Internal EMR notes (`clinical_records` of type `visit`, `treatment_plan`, `surgical_log`), `dental_chart_json`, `perio_chart_json`, `misc_records_json`, `pain_scale`/`severity_level` triage notes, `tracker_stage`.
       - Any document, X-ray, or clinical/surgery photograph where `is_shared_with_patient == False`.
     - **Explicitly Permitted (Only What the Doctor Wants the Patient to Know):**
       - **Next & Past Appointments:** Date, time, clinic operatory/department, attending doctor's display name only, appointment status, pre-appointment instructions, and Google Calendar sync / `.ics` download (`GET /api/v1/patient-portal/appointments`).
       - **Prescriptions & Treatment Instructions:** Issued prescriptions (`record_type='prescription'` & `is_visible_to_patient=True`, localized EN/HI/PA + PDF download) and doctor-sent pre-appointment / post-treatment care instructions & preventive care messages (`GET /api/v1/patient-portal/prescriptions`).
       - **Requested Tests, Scans & Shared Documents:** Explicit doctor-created advisories from `patient_shared_notices_json` (e.g., *"Get OPG X-ray / CBCT / Blood Test done and bring on next visit"*) + ONLY `documents` rows where `is_shared_with_patient == True` (`GET /api/v1/patient-portal/shared-items`).
     - **Frontend Patient Portal (`frontend/src/components/layout/PatientLayout.tsx` & `frontend/src/pages/patient/`):**
       - Update nav to 3 clean tabs: **My Appointments** (`PatientAppointments.tsx`), **My Prescriptions & Instructions** (`PatientPrescriptions.tsx`), and **Tests, Scans & Shared Records** (`PatientSharedRecords.tsx`, replacing unfiltered `PatientXrays.tsx` and deleted `PatientInvoices.tsx`).

#### 2.2 Fix Dashboard Contracts & Add Doctor Missed-Patient / Severity Controls (Req 2.2, 6.3)
- **Files:** `backend/app/schemas/dashboard.py`, `backend/app/services/dashboard_service.py`, `frontend/src/pages/Dashboard.tsx`.
- Align all field names between `AdminDashboardResponse`, `DoctorDashboardResponse`, `StudentDashboardResponse`, and `Dashboard.tsx`.
- Fix `get_student_dashboard` queries against the 8-table schema and strictly scope all metrics/lists to `Patient.student_id == current_student.id`.
- Update `get_doctor_dashboard` so Doctors see total branch patients (`all_patients_count`) alongside their direct/supervised counts, plus the branch-wide student roster.
- On the **Doctor Dashboard**, add two dedicated action widgets:
  1. **Missed Appointments & Add Missed Patient Panel:** Lists missed/`no_show` appointments and overdue patients; includes an **"Add Missed Patient / Log Missed Appointment"** button/modal (`POST /api/v1/appointments/missed`) allowing the doctor to select a patient (or quick-log by CR Number), specify missed date/reason, auto-flag `tracker_stage = "slipping"`, and optionally trigger a recall SMS/Email.
  2. **Quick Pain / Severity Triage Widget:** Shows high-severity/high-pain patients (`pain_scale >= 6` or `severity_level in ['severe', 'critical']`) with inline slider/dropdown to update any patient's `pain_scale` (0–10) and `severity_level` via `PATCH /api/v1/patients/{id}/severity`.
- On **Admin Students Management (`frontend/src/pages/Students.tsx`)**:
  - Add search by name/email, optional supervising doctor selector (not mandatory), patient assignment count badge, and a prominent **"Remove & Revoke Access"** button (with confirmation dialog noting instant login/token revocation and safe preservation of patient records).

---

### Phase 3: Patient Registration, Consent, Segregation & Tracker (Req 3)

#### 3.1 Fix Patient Registration, CR Number & Card Upload (Req 3.1, 3.2)
- **Files:** `frontend/src/pages/Patients.tsx`, `frontend/src/components/patients/PatientFormModal.tsx`, `backend/app/routers/patients.py`, `backend/app/services/patient_service.py`, `backend/app/schemas/patient.py`.
- Fix `Patients.tsx`: `const canRegister = hasRole('admin', 'doctor', 'dentist', 'student');`.
- Fix `PatientFormModal.tsx`: Change `formData.append('card_file', cardFile)` to `formData.append('file', cardFile)`.
- Allow Admin/Doctor to assign or reassign `student_id` (any active student in the branch) and optionally `doctor_id` during registration or edit.
- Add **Parent/Guardian Consent** fields in `PatientFormModal.tsx` (auto-highlighted when patient age < 18 or `special_case_flag` is checked):
  - `parent_consent_required`, `parent_guardian_name`, `parent_guardian_phone`, `parent_consent_status`, and consent form file upload (`POST /api/v1/patients/{id}/consent` storing encrypted file in `documents` as `document_type="parent_consent"`).
- Add **Case Keywords** tag input (preset chips: `Pediatric (<18)`, `Geriatric (60+)`, `Special Case`, `Medically Compromised`, `Pregnant`, `Emergency`, plus custom keywords) and **Preferred Language** selector (`English`, `Hindi`, `Punjabi`).

#### 3.2 Category-Wise & Keyword-Based Case Segregation (Req 3.3)
- **Files:** `backend/app/routers/patients.py`, `backend/app/services/patient_service.py`, `frontend/src/pages/Patients.tsx`.
- Extend `GET /api/v1/patients` with query parameters:
  - `categories` (comma-separated multi-select disease categories; supports matching patients belonging to multiple categories)
  - `keyword` (matches `case_keywords`, `disease_categories`, medical conditions, or free-text tag)
  - `age_group` (`pediatric` <18 | `adult` 18–59 | `geriatric` >=60)
  - `special_case` (boolean)
  - `severity` (`mild | moderate | severe | critical`)
  - `scope` (`all | mine` — for Doctors defaults to `all`; for Students always strictly enforced to `student_id == current_student.id` regardless of query parameter)
- Upgrade `Patients.tsx`:
  - Show **CR Number**, **Disease Category badges** (each clickable to filter), **Severity/Pain badge**, **Assigned Student / Doctor**, and **Consent status**.
  - Add collapsible **Category-Wise Checkbox Filter Bar** (multi-select disease checkboxes) + **Keyword / Age Group / Special Case** filter chips.

#### 3.3 Patient Tracker (Telephonic Enquiries & Slipping Patients) (Req 3.4)
- **Backend (`backend/app/routers/tracker.py` backed by `care_and_system_logs` where `event_type='enquiry'` + `patients`):**
  - `GET /api/v1/tracker/overview` — counts and lists grouped by stage (`enquiry`, `registered`, `diagnosed`, `in_treatment`, `followup`, `slipping`, `completed`); scoped to assigned patients only for Students, branch-wide for Doctors/Admin.
  - `GET /api/v1/tracker/enquiries` & `POST /api/v1/tracker/enquiries` — log telephonic/social media enquiries (caller name, phone, source channel, chief complaint, preferred language, follow-up date, notes, assigned doctor/student).
  - `PATCH /api/v1/tracker/enquiries/{id}` — update stage, mark contacted, or one-click **"Convert to Registered Patient"** (`POST /api/v1/tracker/enquiries/{id}/convert`).
  - `GET /api/v1/tracker/slipping` — automatically flags patients with missed appointments (`no_show`), overdue follow-ups (>7 days past `scheduled_date`), or open enquiries with no contact in >3 days.
- **Create frontend page:** `frontend/src/pages/PatientTracker.tsx`, API client `frontend/src/api/tracker.ts`, add route `/tracker` and Sidebar link (visible to Admin, Doctor, Student).

---

### Phase 4: Complete EMR, Perio Charting, Surgical Logs & Media (Req 4 & 5)

#### 4.1 Priority EMR Patient Profile Overhaul (`frontend/src/pages/PatientDetail.tsx`)
- Fix all role checks from `hasRole('dentist', 'admin')` to `hasRole('admin', 'doctor', 'dentist', 'student')` (with prescriptions and "Share with Patient" controls restricted to Doctor/Admin as appropriate).
- **Top Priority Demographics Card:** Always visible above tabs — CR Number, Patient Code, Full Name, Age/DOB, Gender, Phone, Email, Address, Blood Group, Preferred Language, Assigned Student & Doctor (with quick reassign dropdown for Doctor/Admin), **Patient Card Preview/Upload modal**, **Parent Consent Status & Document preview**, and **Interactive Pain Scale (0–10) + Severity Level dropdown** (`PATCH /api/v1/patients/{id}/severity`).
- **Disease Categories Panel with Direct Date-Wise X-Ray Hyperlinks (Req 5.2):**
  - Display every checked disease category as an interactive card/accordion right below Demographics (and inside the X-rays/Media tab).
  - Fetch `GET /api/v1/patients/{id}/xrays-datewise` and group X-rays by `disease_category` and `media_date`.
  - Under each disease category, render direct **date-wise hyperlinks** (e.g., `12 Nov 2026 — OPG Panoramic (Pre-Treatment)`) that immediately open the authenticated radiograph lightbox/viewer.
- **Doctor-to-Patient Advisories ("Tests / Scans to Conduct & Share") Section:**
  - Allows Doctors/Admin to add explicit patient-visible requests (e.g., *"Conduct CBCT Mandible and bring films on next visit"*, *"HbA1c lab test required"*), saved in `patient_shared_notices_json` and immediately visible in the Patient Portal without exposing internal clinical notes.

#### 4.2 General & Intraoral Examinations + Clinical Pain Scale (Req 4.2, 4.3)
- **Files:** `backend/app/routers/visits.py`, `backend/app/services/clinical_service.py`, `backend/app/schemas/clinical.py`, `frontend/src/components/clinical/VisitModal.tsx`, `frontend/src/pages/PatientDetail.tsx`.
- Store visits in `clinical_records` (`record_type='visit'`, `is_visible_to_patient=False`) with structured `payload_json`:
  - `general_exam_notes`, `extraoral_findings`, `tmj_status`, `lymph_nodes`
  - `intraoral_hard_tissue`, `intraoral_soft_tissue`, `occlusion_status`
  - `pain_scale` (Integer 0–10), `severity_level`
- Update `VisitModal.tsx` with clear sections: **Vitals & General Examination**, **Intraoral Examination**, **Pain Scale (0–10 interactive slider with color feedback) & Severity**, and **Diagnosis & Clinical Notes** (labeled *Private Clinical Record*). Saving a visit automatically syncs the patient's latest `pain_scale` and `severity_level`.

#### 4.3 Periodontal (Perio) Charting Alongside Restorative Charting (Req 4.4)
- **Create frontend component:** `frontend/src/components/dental/PerioChart.tsx`.
- **Update `backend/app/routers/dental_chart.py` & `dental_service.py`:**
  - Store restorative FDI chart in `patients.dental_chart_json` and 6-site periodontal chart in `patients.perio_chart_json` (enforcing `verify_patient_access`).
  - Endpoints: `GET / PUT /api/v1/dental-chart/{patient_id}/perio` alongside existing FDI restorative endpoints.
- **Perio Chart UI features:**
  - Toggle inside Patient Profile → **Dental Chart** tab: `[Restorative Chart (FDI)]` | `[Perio Chart]`.
  - Per-tooth inputs for **Probing Pocket Depth (mm)** across 6 sites (MB, B, DB, ML, L, DL), **Gingival Recession (mm)**, **Bleeding on Probing (BOP)** toggle, **Mobility Grade (0–III)**, **Furcation Grade (0–III)**, and **Plaque Index**.
  - Color-coded visual highlighting (pocket depths >= 4mm amber, >= 6mm red) + auto-computed summary metrics (Mean PPD, % BOP sites, deepest pocket).

#### 4.4 Date-Wise Surgical Treatment Logs & Category-Specific Miscellaneous Records (Req 4.5, 4.7)
- **Backend endpoints:**
  - `GET / POST / PUT / DELETE /api/v1/patients/{id}/surgical-logs` (stored as `clinical_records` with `record_type='surgical_log'`, `is_visible_to_patient=False`; supports linking encrypted `surgery_photo` documents via `documents.clinical_record_id`).
  - `GET / PUT /api/v1/patients/{id}/miscellaneous` (stored in `patients.misc_records_json` keyed by disease category).
  - `GET / POST / DELETE /api/v1/patients/{id}/shared-notices` (stored in `patients.patient_shared_notices_json`).
- **Frontend UI in `PatientDetail.tsx`:**
  - Inside **Treatments** tab: Add sub-section **"Date-Wise Surgical Treatment Log"** with "+ Log Surgical Procedure" modal and chronological table linked to surgery photographs.
  - Add dedicated **Miscellaneous** tab organized by the patient's disease categories (plus a "General" bucket) with inline save.

#### 4.5 Complete Media & Photography Storage UI (Req 5.1, 5.2)
- **Files:** `frontend/src/components/documents/DocumentUploadModal.tsx`, `frontend/src/pages/Documents.tsx`, `frontend/src/pages/PatientDetail.tsx`, `frontend/src/api/documents.ts`.
- Support uploading & filtering all required media types:
  - **Imaging:** `xray`, `opg`, `cbct` (accepting both 2D PNG/JPG/PDF screenshots AND raw `.dcm`, `.nii`, `.nii.gz`, `.zip`, `.glb` up to 500 MB)
  - **Photography:** `intraoral_photo`, `extraoral_photo`, `iop_photo`, `profile_photo`, `surgery_photo`, `misc_photo`
  - **Clinical Docs:** `patient_card`, `parent_consent`, `lab_report`, `other`
- Group media by **Date** (date-wise timeline) OR **Treatment Stage** (`initial_assessment`, `pre_treatment`, `mid_treatment`, `surgery`, `post_treatment`, `follow_up`) OR **Photo/Imaging Type** filter chips.
- Include a Doctor/Admin **"Share with Patient"** toggle switch (`PATCH /api/v1/documents/{id}/share`) with clear badge (`Private Clinical` vs `Shared with Patient`).
- Authenticated image lightbox preview (loads via JWT blob fetch so zero unauthenticated URLs exist) + secure download for raw CBCT archives.

#### 4.6 Prescriptions (Auto-Rx, Templates) & Treatment Instructions in EN / HI / PA (Req 1.3, 4.6, 4.7)
- **Create backend localization module:** `backend/app/i18n/translations.py` containing clinically accurate translations in **English (`en`)**, **Hindi (`hi` — Devanagari)**, and **Punjabi (`pa` — Gurmukhi)** for:
  - Prescription headings, dosage frequencies (`1-0-1`, `1-1-1`, `SOS`), meal timings (`After Food`, `Before Food`, `Before Bedtime`), duration labels.
  - Standardized **Pre-Appointment Instructions** (e.g., Fasting/medication notice, Bring old X-rays & CR card, Routine checkup prep).
  - Standardized **Post-Treatment Instructions** (e.g., Post-Extraction Care, Post-RCT Care, Post-Scaling Care, Post-Oral Surgery Care).
  - Appointment confirmation/reschedule/cancellation SMS & Email templates.
  - Preventive care templates (Pediatric hygiene, Diabetic oral care, Tobacco cessation, Periodontal maintenance, Pregnancy oral care).
- **Prescription Templates (Auto-Prescription):**
  - Stored in `clinical_records` (`record_type='rx_template'`, `patient_id=NULL`) with `GET / POST /api/v1/prescriptions/templates` (seeded with 6 standard dental templates: Acute Pulpitis, Post-Extraction, Periodontal Infection, Dental Abscess, Aphthous Ulcer, Pediatric Pain Relief).
  - Update `PrescriptionModal.tsx`: Add **"Auto-Fill from Template"** dropdown + **Language Selector (`English / हिंदी / ਪੰਜਾਬੀ`)** with live localized instruction preview.
- **Unicode PDF Generation (`backend/app/pdf/generator.py`):**
  - Bundle/register **Noto Sans Devanagari** and **Noto Sans Gurmukhi** TTF fonts in `backend/app/pdf/fonts/` so Hindi and Punjabi prescription PDFs render crisply without missing-glyph boxes (`□□□`).
- **Treatment Instructions UI:**
  - Add a **Treatment Instructions** sub-section in `PatientDetail.tsx` allowing Doctors/Students to select standardized pre-appointment or post-treatment instructions in English, Hindi, or Punjabi, preview localized text, print/PDF, mark visible to the patient, and dispatch via SMS/Email/WhatsApp.

---

### Phase 5: Smart Calendar, Google Calendar, Notifications, Recalls & Social Media (Req 6 & 7)

#### 5.1 Smart Calendar with Doctor-Wise & Operatory-Wise Views (Req 6.1)
- **Backend (`backend/app/services/appointment_service.py`, `routers/appointments.py`):**
  - Conflict checker prevents BOTH **same-doctor** and **same-operatory** overlapping bookings.
  - Add `GET /api/v1/appointments/calendar?date=YYYY-MM-DD&view=doctor|operatory&range=day|week` (scoped to assigned patients for Students; branch-wide for Doctors/Admin).
- **Frontend (`frontend/src/pages/Appointments.tsx`, `frontend/src/components/appointments/AppointmentModal.tsx`):**
  - Interactive **Smart Calendar** with view switcher: **`Doctor View`** (columns = Doctors, rows = 30-min time slots 08:30–17:00), **`Operatory View`** (columns = Operatories/Chairs, rows = time slots), and **`List View`**.
  - Color-coded appointment blocks by status/type, click-to-book empty slot, click-to-view/update status, and operatory selector in `AppointmentModal.tsx`.

#### 5.2 Google Calendar Integration (Doctors & Patients) (Req 6.2)
- **Create backend service:** `backend/app/services/google_calendar_service.py` and router endpoints in `backend/app/routers/integrations.py`:
  - Supports live Google Calendar API v3 sync when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and OAuth tokens are configured in `.env`.
  - Always generates valid **RFC 5545 `.ics` calendar invites** (`GET /api/v1/appointments/{id}/ics`) and deep **"Add to Google Calendar" URLs** (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`) for BOTH the doctor and the patient so sync works immediately for the viva demo.
  - Expose sync status badge (`Synced` / `Ready to Sync` / `Download .ics`) in `Appointments.tsx` and `PatientAppointments.tsx`.

#### 5.3 Patient Care Notification Engine, Custom SMS Sender ID, Automatic Recalls & Preventive Care (Req 7.1–7.4)
- **Create backend files:** `backend/app/services/notification_service.py`, `backend/app/routers/notifications.py` (persisting all notification logs, recalls, and `clinic_config` inside `care_and_system_logs`).
- **Configuration (`backend/app/config.py`, `.env.example`):**
  - Add `SMS_SENDER_ID: str = "PGIDNT"`, `SMS_PROVIDER: str = "sandbox"` (`sandbox | twilio | msg91`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.
  - In `sandbox` mode (default for viva demo), persist every dispatched SMS and Email into `care_and_system_logs` (`event_type='notification'`) with `sender_id`, `recipient`, `channel`, `language`, `category`, `message_body`, and `status="sent_sandbox"`.
- **Automated Triggers:**
  1. **Appointment Lifecycle Alerts:** Booking, rescheduling, or cancelling an appointment automatically dispatches localized (`patient.preferred_language`) SMS + Email alerts plus **pre-appointment instructions** on booking.
  2. **Post-Treatment Instructions:** Completing a treatment item or saving a surgical log automatically dispatches localized **post-treatment care instructions**.
  3. **Automatic Recalls Engine:**
     - `POST /api/v1/notifications/recalls/generate`: Auto-schedules **Regular Check-up Recalls** (6 months) and **Treatment-Specific Recalls** (Suture removal = 7 days, Crown check = 14 days, RCT follow-up = 30 days, Perio maintenance = 90 days).
     - `POST /api/v1/notifications/recalls/dispatch-due`: Dispatches localized SMS/Email reminders for all due recalls.
  4. **Preventive Care Messaging Engine:**
     - `GET /api/v1/notifications/preventive-care/preview/{patient_id}` & `POST /api/v1/notifications/preventive-care/send`: Evaluates patient **demographics** (pediatric/geriatric), **medical conditions** (diabetes, hypertension, pregnancy), **dental conditions/categories** (caries, periodontitis, orthodontics), and **habits** (smoking, tobacco, bruxism, poor brushing) to generate and send tailored preventive messages in EN / HI / PA.
- **Create frontend page:** `frontend/src/pages/PatientCare.tsx` (Route `/patient-care`, Sidebar item "Patient Care & Alerts") with tabs:
  - **Notification Center & SMS Sender ID Settings**
  - **Automatic Recalls** (Regular & Treatment-specific + one-click dispatch)
  - **Preventive Care Campaigns** (filter by demographics/condition/habit, preview EN/HI/PA, send)
  - **Social Media Hub** (Req 7.5).

#### 5.4 Social Media Integration (Req 7.5)
- **Backend (`backend/app/routers/integrations.py`):**
  - Store clinic social media channel settings (`whatsapp_number`, `instagram_url`, `facebook_url`, `youtube_url`, `webhook_token`) in `care_and_system_logs` (`event_type='clinic_config'`).
  - Webhook / intake endpoint `POST /api/v1/integrations/social-lead` captures incoming enquiries from Instagram/Facebook/WhatsApp directly into the **Patient Tracker** (`event_type='enquiry'`, `channel=source_channel`).
  - Pre-filled **WhatsApp Share / Direct Message links** (`https://wa.me/...`) containing localized appointment reminders, prescription summaries, or preventive care tips.
- **Frontend:**
  - Inside `PatientCare.tsx` → **Social Media** tab: Configure PGI Dental social channels, test incoming social lead capture into Patient Tracker, and share oral health campaigns.
  - On `PatientDetail.tsx`, `Appointments.tsx`, and `Prescriptions.tsx`: One-click **"Share via WhatsApp"** action button using localized EN/HI/PA text.

---

### Phase 6: Multi-Device Responsive UI Polish (Req 1.1)
- **Files:** `frontend/src/components/layout/MainLayout.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/Header.tsx`, `frontend/src/components/dental/FDIToothChart.tsx`, `frontend/src/components/dental/PerioChart.tsx`, `frontend/src/pages/PatientDetail.tsx`, `frontend/src/pages/Appointments.tsx`.
- Convert `Sidebar.tsx` into a **responsive drawer** (`w-64` persistent on `lg:`, slide-over drawer with hamburger button in `Header.tsx` on `< lg`).
- Make `PatientDetail.tsx` tab bar horizontally scrollable (`overflow-x-auto whitespace-nowrap`).
- Make `FDIToothChart.tsx`, `PerioChart.tsx`, and `Appointments.tsx` Smart Calendar horizontally scrollable with sticky labels on `< 768px` viewports.
- Ensure zero horizontal viewport overflow at `390px` (mobile), `768px` (tablet), and `1440px` (desktop).

---

## 4. Testing, Verification & Objective Scoring Rubric

### Automated Verification Commands
1. **Backend Unit & Integration Tests (`cd backend && pytest -v`):**
   - Schema verification test asserting `Base.metadata.tables` has **exactly 8 tables**: `doctors`, `students`, `patients`, `users`, `appointments`, `clinical_records`, `documents`, `care_and_system_logs`.
   - Role Access & Isolation tests:
     - Doctor A views ALL patients (Doctor A, Doctor B, Student 1, Student 2, unassigned).
     - Student 1 (assigned 5 patients) sees/edits ONLY those 5 and gets `403` on every endpoint for any other patient.
     - Student created without a mandatory supervising doctor (`doctor_id=None`).
     - Admin removes Student (by ID or email) → Student's already-issued JWT immediately fails with `401 Unauthorized`, re-login fails, refresh fails, and previously assigned patient records stay intact (`student_id=None`).
     - Receptionist accesses ONLY `/api/v1/attendance/*` (`403` on patient edits, EMR, documents, prescriptions).
     - Patient CANNOT access doctor details, internal clinical records (`visit`, `treatment_plan`, `surgical_log`), charts, or unshared documents (`403`); Patient CAN access appointments (with Google Cal/`.ics`), prescriptions (EN/HI/PA), treatment instructions, doctor-created test/scan advisories, and explicitly shared documents.
   - Secure File Storage tests:
     - Uploaded file stored encrypted on disk (raw bytes do NOT match plaintext magic bytes), decrypted cleanly on authorized download, checksum verified, relative `storage_key` stored.
     - Flexible CBCT upload accepts both 2D PNG/PDF AND raw `.dcm` / `.nii.gz` / `.zip` binary files; rejects `.html`/`.exe`.
     - IDOR test: Student 1 attempting to download Student 2's patient X-ray returns `403`; Receptionist returns `403`; Patient attempting to download unshared surgery photo returns `403`.
   - Clinical & Integration tests: CR Number & card upload, Parent consent, Disease categories & keyword filters, Perio chart CRUD, Surgical logs, Multilingual EN/HI/PA PDFs (embedded Unicode fonts), Smart Calendar doctor & operatory conflicts, Google Calendar `.ics`, Notification sandbox + custom `SMS_SENDER_ID`, Automatic recalls, Preventive care rules, Patient Tracker conversion, and Social lead webhook.
2. **Frontend Build & Unit Tests (`cd frontend && npm run lint && npm run test && npm run build`):** Zero TypeScript errors, 100% test pass.
3. **Live Browser E2E Verification:** Seed fresh DB, spin up backend (`:8000`) & frontend (`:5173`), run full multi-role browser walkthrough with screenshot visual inspection across Desktop (`1440x900`), Tablet (`768x1024`), and Mobile (`390x844`).

### Objective Scoring / Pass-Fail Rubric (100 Points Total — Pass Threshold: 100/100, Zero Critical Failures)

| ID | Category | Objective Verification Criteria | Points |
| :--- | :--- | :--- | :---: |
| **R1** | **No Payment Module** | Zero billing/invoice/payment routes, UI links, cost inputs, DB tables, or API endpoints (`/api/v1/billing` returns 404). | 7 |
| **R2** | **Multi-Device Responsiveness & PGI Branding** | PGI Dental branding visible across login, sidebar, PDFs. Mobile (`390px`) & Tablet (`768px`) show functional hamburger drawer, readable tables/charts, and zero horizontal page overflow. | 7 |
| **R3** | **Exact 8-Table Schema (3 Core + 5 Supporting)** | Database contains strictly **8 tables** (`doctors`, `students`, `patients` + `users`, `appointments`, `clinical_records`, `documents`, `care_and_system_logs`) on SQLite/MySQL; `students.doctor_id` nullable; `patients.student_id` uses `ON DELETE SET NULL`; duplicate `dentists` & billing tables eliminated. | 8 |
| **R4** | **RBAC: Admin, Instant Student Revocation & Doctor Full Visibility** | Admin manages Doctors/Students, designates Admin doctor, and removing a student (by ID/email) **immediately revokes active JWT (`401`)** while preserving patient records. Every Doctor views **ALL** patients regardless of assignment, logs missed patients, and updates pain/severity from Doctor Dashboard with zero `403` errors. | 10 |
| **R5** | **RBAC: Strict Student Isolation & Receptionist Attendance-Only** | Student sees/edits **ONLY assigned patients** and gets strict `403` on all unassigned/other-student patients across every EMR/media/calendar endpoint. Student registers new patients (auto-linked to self). Receptionist accesses ONLY `/attendance` (`403` on patient edits/EMR/docs). | 10 |
| **R6** | **Patient Portal Privacy & Opt-In Clinical Sharing** | Logged-in Patient CANNOT view doctor personal details, clinical notes, exams, charts, treatments, surgical logs, or unshared scans (`403`/hidden). Patient CAN view ONLY appointments (with Google Cal/`.ics`), prescriptions & care instructions, doctor-issued test/scan requests ("conduct & bring"), and files explicitly marked `Share with Patient`. | 9 |
| **R7** | **Registration, Consent, Categories & Patient Tracker** | Patient card upload + CR Number work end-to-end (HTTP 200/201 + preview). Parent consent saves & previews. Multi-select disease categories + keyword/age/special-case filters return exact matches. Patient Tracker logs telephonic enquiries, detects slipping patients, and converts enquiry to patient. | 8 |
| **R8** | **Core EMR, Pain Scale & Perio + Restorative Chart** | Priority Demographics card at top of profile. General + Intraoral exam saved on visits. Pain scale (0–10) & severity adjustable. Both Restorative FDI Chart AND 6-site Perio Chart save, reload, and color-highlight pockets >= 4mm. | 8 |
| **R9** | **Surgical Logs, Prescriptions, Instructions & Misc** | Date-wise surgical treatment logs save with linked surgery photos. Separate Prescriptions section supports Auto-Rx Templates. Standardized Treatment Instructions and Category-specific Miscellaneous records save and display cleanly. | 7 |
| **R10** | **Multilingual EN / HI / PA & Unicode PDFs** | Prescriptions, treatment instructions, and appointment/recall reminders render accurately in English, Hindi (Devanagari), and Punjabi (Gurmukhi) in UI and downloaded PDFs (zero missing-glyph boxes). | 7 |
| **R11** | **Secure Flexible Storage, 6 Photo Types & Disease X-Ray Links** | Files encrypted at rest in local vault (`StorageBackend` S3-ready), zero IDOR leaks (`403` verified), supports 2D scans/photos (`xray`, `opg`, `cbct`, `intraoral`, `extraoral`, `iop`, `profile`, `surgery`, `misc`) AND raw CBCT files (`.dcm`/`.nii.gz`/`.zip`), organized date-wise & by stage, with `Share with Patient` toggle and clickable date-wise X-ray hyperlinks under each disease category. | 8 |
| **R12** | **Smart Calendar & Google Calendar Sync** | Smart Calendar toggles between **Doctor View** and **Operatory View**, prevents doctor & operatory conflicts, and provides working Google Calendar sync links + `.ics` downloads for doctors and patients. | 6 |
| **R13** | **Patient Care, Recalls, Preventive & Social** | Custom SMS Sender ID configurable; booking/update/cancel triggers logged SMS/Email alerts + pre-appointment instructions; completing treatment triggers post-treatment instructions; regular & treatment-specific recalls and demographic/condition/habit preventive messages generate & dispatch; WhatsApp share & social lead capture work end-to-end. | 5 |
| | **TOTAL** | **All automated tests pass + all live browser screenshots verified against R1–R13** | **100** |