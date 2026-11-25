# PGI Dental Management System - REST API Reference

Base URL: `/api/v1`  
OpenAPI Documentation: `http://localhost:8000/docs` or `http://localhost:8000/redoc`

> **Access Control:** Every patient-scoped endpoint enforces `verify_patient_access` (Admins & Doctors: branch-wide; Students: assigned patients only; Receptionists: Attendance desk only; Patients: `/patient-portal/*` only). Billing, invoice, and payment endpoints are permanently removed.

---

## 1. Authentication Endpoints

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `POST` | `/auth/login` | Public | Authenticate with username or email and password | `200 OK` |
| `POST` | `/auth/refresh` | Public | Exchange valid refresh token for a new access token | `200 OK` |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token and terminate active session | `200 OK` |
| `GET` | `/auth/me` | Authenticated | Retrieve currently authenticated user profile | `200 OK` |

---

## 2. Patients, Registration & Clinical Dossier

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/patients` | Admin, Doctor, Student | List/filter patients (`scope`, `categories`, `keyword`, `age_group`, `severity`, `special_case_only`) | `200 OK` |
| `POST` | `/patients` | Admin, Doctor, Student | Register patient (CR Number, disease categories, keywords, allergies, severity) | `201 Created` |
| `GET` | `/patients/{id}` | Admin, Doctor, Student (scoped) | Get comprehensive patient profile & medical history | `200 OK` |
| `PUT` | `/patients/{id}` | Admin, Doctor, Student (scoped) | Update patient demographics & clinical metadata | `200 OK` |
| `PATCH` | `/patients/{id}/severity` | Admin, Doctor, Student (scoped) | Update pain scale (0–10) & triage severity | `200 OK` |
| `POST` | `/patients/{id}/card-and-consent` | Admin, Doctor, Student (scoped) | Upload registration card & signed consent to AES-256-GCM vault | `200 OK` |
| `GET` / `POST` | `/patients/{id}/surgical-logs` | Admin, Doctor, Student (scoped) | List and record surgical procedures (`tooth_numbers` array, operative notes) | `200 OK` / `201 Created` |
| `GET` / `PUT` | `/patients/{id}/miscellaneous` | Admin, Doctor, Student (scoped) | Retrieve or update disease-category miscellaneous notes | `200 OK` |
| `GET` / `POST` | `/patients/{id}/shared-notices` | Admin, Doctor, Student (scoped) | Manage explicit patient-facing advisories (tests/scans to bring) | `200 OK` / `201 Created` |
| `DELETE` | `/patients/{id}` | Admin, Doctor | Soft-delete / archive patient record | `200 OK` |
| `GET` | `/patients/{id}/timeline` | Admin, Doctor, Student (scoped) | Get complete chronological clinical history timeline | `200 OK` |

---

## 3. FDI Dental Chart & 6-Site Perio Chart Endpoints

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/dental-chart/{patient_id}` | Admin, Doctor, Student (scoped) | Retrieve all 32 teeth conditions and historical notes | `200 OK` |
| `POST` | `/dental-chart/{patient_id}/tooth` | Admin, Doctor, Student (scoped) | Update tooth condition & append to clinical history | `200 OK` |
| `GET` | `/dental-chart/{patient_id}/tooth/{tooth_number}/history` | Admin, Doctor, Student (scoped) | View detailed longitudinal history for single tooth | `200 OK` |
| `GET` / `PUT` | `/dental-chart/{patient_id}/perio` | Admin, Doctor, Student (scoped) | Retrieve or save 32-tooth, 6-site Periodontal Chart (`MB/B/DB/ML/L/DL`, BOP, mobility, furcation) | `200 OK` |

---

## 4. Appointments, Smart Calendar & Attendance

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/appointments` | Admin, Doctor, Student | Query appointments by date, doctor, or status | `200 OK` |
| `POST` | `/appointments` | Admin, Doctor, Student | Book appointment with doctor/operatory conflict check | `201 Created` |
| `GET` | `/appointments/calendar` | Admin, Doctor, Student | Smart Calendar data for Doctor View & Operatory View | `200 OK` |
| `GET` | `/appointments/missed` | Admin, Doctor, Student | Missed/no-show appointments list for triage follow-up | `200 OK` |
| `GET` | `/appointments/{id}/ics` | Authenticated (scoped / Patient) | Download RFC 5545 `.ics` calendar file | `200 OK` |
| `PUT` | `/appointments/{id}` | Admin, Doctor, Student | Reschedule or edit appointment details | `200 OK` |
| `PATCH` | `/appointments/{id}/status` | Admin, Doctor, Student, Receptionist | Transition status (`confirmed`, `completed`, `cancelled`, `no_show`) | `200 OK` |
| `GET` | `/attendance/today` | Receptionist, Doctor, Admin | Today's scheduled appointments & walk-in queue | `200 OK` |
| `PATCH` | `/attendance/{appointment_id}/mark` | Receptionist, Doctor, Admin | Mark `checked_in`, `present`, `completed`, or `missed` | `200 OK` |
| `POST` | `/attendance/walkin-checkin` | Receptionist, Doctor, Admin | Register/check in walk-in patient attendance | `201 Created` |

---

## 5. Clinical Visits & Examinations

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `POST` | `/visits` | Admin, Doctor, Student (scoped) | Record clinical visit, vitals, and examination findings | `201 Created` |
| `GET` | `/visits/{id}` | Admin, Doctor, Student (scoped) | Retrieve specific visit details and diagnoses | `200 OK` |
| `GET` | `/visits/patient/{patient_id}` | Admin, Doctor, Student (scoped) | List all clinical visits for a patient | `200 OK` |

---

## 6. Treatment Plans & Procedures (Cost-Free)

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/treatments/catalog` | Admin, Doctor, Student | Standard cost-free dental procedure catalog | `200 OK` |
| `GET` | `/treatments/plans` | Admin, Doctor, Student | List treatment plans with patient/doctor filter | `200 OK` |
| `POST` | `/treatments/plans` | Admin, Doctor, Student (scoped) | Create multi-procedure treatment plan | `201 Created` |
| `GET` | `/treatments/plans/{id}` | Admin, Doctor, Student (scoped) | Get treatment plan details and item progress | `200 OK` |
| `POST` | `/treatments/plans/{id}/items`| Admin, Doctor, Student (scoped) | Add new procedure item to existing plan | `200 OK` |
| `PUT` | `/treatments/items/{item_id}` | Admin, Doctor, Student (scoped) | Update procedure status (`in_progress`, `completed`) | `200 OK` |

---

## 7. Multilingual Prescriptions & HarfBuzz PDF (EN / HI / PA)

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/prescriptions/catalog` | Admin, Doctor, Student | Approved pharmacy formulary & Auto-Rx templates | `200 OK` |
| `GET` | `/prescriptions` | Admin, Doctor, Student | List issued prescriptions | `200 OK` |
| `POST` | `/prescriptions` | Admin, Doctor, Student (scoped) | Create localized prescription (`en`/`hi`/`pa`) | `201 Created` |
| `GET` | `/prescriptions/{id}` | Admin, Doctor, Student (scoped) | Retrieve prescription record and items | `200 OK` |
| `GET` | `/prescriptions/{id}/pdf` | Admin, Doctor, Student, Patient (self) | Stream HarfBuzz-shaped EN/HI/PA vector PDF | `200 OK` |

---

## 8. Patient Portal (Strict Privacy Isolation)

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/patient-portal/appointments` | Patient, Admin | Own appointments + Google Calendar URL + `.ics` download + prep hints | `200 OK` |
| `GET` | `/patient-portal/prescriptions` | Patient, Admin | Own visible prescriptions + `care_instructions` alerts | `200 OK` |
| `GET` | `/patient-portal/shared-items` | Patient, Admin | Exclusively shared notices and `is_shared_with_patient=True` documents | `200 OK` |

---

## 9. Encrypted Documents & Oral-3D X-Rays

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` | `/documents/patient/{patient_id}`| Admin, Doctor, Student (scoped) | List encrypted clinical media & documents (category/stage/date filters) | `200 OK` |
| `POST` | `/documents/upload` | Admin, Doctor, Student (scoped) | Upload into AES-256-GCM vault (up to 500 MB CBCT / 25 MB standard) | `201 Created` |
| `PATCH` | `/documents/{id}/share` | Admin, Doctor, Student (scoped) | Toggle `is_shared_with_patient` opt-in visibility | `200 OK` |
| `GET` | `/documents/{id}/download` | Authenticated (scoped / shared) | Decrypt and stream authorized document/image | `200 OK` |
| `GET` / `POST` | `/xrays/*` | Admin, Doctor, Student (scoped) | Oral-3D reconstruction, MPR slices, date-wise category X-rays | `200 OK` |

---

## 10. Staff, Tracker, Care Hub, Audit & Health

| Method | Endpoint | Allowed Roles | Description | Status Code |
|---|---|---|---|---|
| `GET` / `POST` / `PUT` / `DELETE` | `/doctors/*`, `/students/*`, `/users/*` | Admin, Admin-Doctor | Manage doctors, flexible-pool students (with instant revocation), and staff users | `200 OK` |
| `GET` / `POST` / `PATCH` | `/tracker/*` | Admin, Doctor, Student | Pipeline overview, slipping patients, and enquiry lead conversion | `200 OK` |
| `GET` / `POST` / `PUT` | `/notifications/*`, `/integrations/*` | Admin, Doctor, Student | SMS (`PGIDNT`)/email alerts, recalls, preventive care, WhatsApp & social webhooks | `200 OK` |
| `GET` | `/dashboard/*` | Admin, Doctor, Student | Role-aware KPIs, missed-patient & severity triage widgets, analytics charts | `200 OK` |
| `GET` | `/audit-logs` | Admin, Admin-Doctor | Searchable audit trail of mutating events | `200 OK` |
| `GET` | `/health` & `/health/ready` | Public | Liveness and database readiness probes | `200 OK` |

---

## 11. Error Response Format

All error responses return a standardized, non-leaking JSON envelope:

```json
{
  "error": {
    "code": "APPOINTMENT_CONFLICT",
    "message": "The selected dentist already has a conflicting appointment at this time.",
    "details": {
      "dentist_id": 2,
      "conflicting_time": "10:00:00"
    }
  }
}
```
