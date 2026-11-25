# AI Handout — PGI Dental Management System
### For the Next AI Agent Picking Up This Project

---

## 1. What You Are Working On

This is a **dental clinic management system** being transformed from "Apex Dental Care" into the
**PGI Dental Branch — Oral Health Sciences Centre, PGIMER Chandigarh** compliant system.

**Repository root:** `Apex-Dental-Care/`  
**Active git branch:** `pgi-dental-compliance`  
**Stack:** FastAPI (Python) backend · React + TypeScript + Vite frontend · SQLite (dev) / MySQL 8 (Docker)

---

## 2. Files to Read First (Priority Order)

| # | File | Purpose |
|---|------|---------|
| 1 | [`pgi_dental_management_system_requirements.md`](./pgi_dental_management_system_requirements.md) | Full product spec — 5 roles, all features, rubric R1–R13 |
| 2 | [`pgi_dental_management_system_implementation_plan.md`](./pgi_dental_management_system_implementation_plan.md) | Phased execution plan (Phases 1–6) you must follow |
| 3 | [`backend/app/models/`](./backend/app/models/) | The locked 8-table SQLAlchemy schema — do NOT add new tables |
| 4 | [`backend/app/security/dependencies.py`](./backend/app/security/dependencies.py) | `get_current_user`, `require_roles`, `verify_patient_access` — apply to every route |
| 5 | [`backend/seeds/seed_data.py`](./backend/seeds/seed_data.py) | PGI seed: 3 doctors, 6 students, 16 patients, all test accounts |
| 6 | [`backend/app/i18n/translations.py`](./backend/app/i18n/translations.py) | EN/HI/PA strings for prescriptions, SMS, preventive care |
| 7 | [`backend/app/storage/file_storage.py`](./backend/app/storage/file_storage.py) | AES-256-GCM `LocalEncryptedStorageBackend` — use for all file I/O |

---

## 3. Git History — What Each Commit Contains

```
cb16c92  feat(phases3-5): clinical EMR, perio chart, tracker, notifications, integrations, i18n PDFs, e2e specs
c6de67f  feat(frontend): PGI Dental responsive UI, EMR, PerioChart, Smart Calendar, PatientCare, Portal
3e0cf70  feat(phase1-2): 8-table schema, AES-256-GCM vault, RBAC, revocation, attendance, portal, seeds
6231c24  chore: branch for PGI compliance + Noto Sans EN/HI/PA fonts
2c4bad8  (origin/main) baseline — before PGI migration started
```

---

## 4. Exact 8-Table Schema (Hard Limit — Do NOT Create More Tables)

| Table | Model file | Key columns |
|-------|-----------|-------------|
| `doctors` | `models/doctor.py` | `is_admin`, `cabin_operatory`, `department`, `google_calendar_id` |
| `students` | `models/student.py` | `doctor_id` nullable, `token_version`, `revoked_at` |
| `patients` | `models/patient.py` | `doctor_id` + `student_id` (ON DELETE SET NULL), `dental_chart_json`, `perio_chart_json`, `misc_records_json`, `patient_shared_notices_json`, `pain_scale`, `severity_level` |
| `users` | `models/user.py` | `token_version`, `refresh_tokens_json`, `revoked_at` |
| `appointments` | `models/appointment.py` | `operatory`, `is_missed`, `attendance_status`, `google_event_id` |
| `clinical_records` | `models/clinical_record.py` | `record_type` (visit\|treatment_plan\|surgical_log\|prescription\|rx_template), `payload_json`, `is_visible_to_patient` |
| `documents` | `models/document.py` | `storage_key`, `is_encrypted`, `encryption_iv`, `sha256_checksum`, `media_date`, `is_shared_with_patient`, `treatment_stage`, `disease_category` |
| `care_and_system_logs` | `models/care_log.py` | `event_type` (enquiry\|followup\|recall\|notification\|audit\|clinic_config) |

> **Rule:** ALL clinical data goes into existing tables via `payload_json` or JSON columns on `patients`. Never create a 9th table.

---

## 5. Seed Test Accounts (password for all: `Dental@123`)

| Email | Role | Notes |
|-------|------|-------|
| `admin@pgi.edu.in` | admin | System admin |
| `dr.mehta@pgi.edu.in` | doctor | `is_admin=True` — faculty admin |
| `dr.sharma@pgi.edu.in` | doctor | Regular doctor |
| `dr.kaur@pgi.edu.in` | doctor | Regular doctor |
| `student1@pgi.edu.in` | student | Has 5 patients assigned |
| `student2@pgi.edu.in` | student | Has 5 patients assigned |
| `student3–6@pgi.edu.in` | student | Various / no doctor locked |
| `reception@pgi.edu.in` | receptionist | Attendance only |
| `patient@pgi.edu.in` | patient | Portal user, linked to Patient #1 |

---

## 6. What Is Done ✅

### Phase 1 & 2 — Backend Foundation (COMPLETE, 36 pytest tests pass)
- **8-table schema** consolidated — billing/payment/invoice tables removed
- **Alembic migration** `001_pgi_8_table_schema.py` runs clean
- **AES-256-GCM file vault** — `backend/app/storage/file_storage.py`
  - Format: `PGIV1` magic header + 12-byte nonce + 1MB chunks
  - Files stored at `backend/uploads/vault/{patient_id}/{uuid}.enc`
  - Magic-byte validation, extension blocklist, chunked streaming for CBCT up to 500MB
- **RBAC & Auth**
  - `token_version` in JWT → instant revocation on student delete
  - `verify_patient_access`: Doctor=all branch, Student=own patients only, Receptionist=403
  - `DELETE /students/{id}` and `DELETE /students/by-email/{email}` → revoke JWT
- **Attendance API** — `/attendance/today`, `/attendance/{id}/mark`, `/attendance/walkin-checkin`
- **Patient Portal API** — 3 endpoints; hides all clinical data, shows only shared items
- **PGI Seed Data** — 1 admin, 3 doctors, 6 students, 1 receptionist, 16 patients, rx templates
- **Ruff linting** passes (`All checks passed!`)

### Phases 1–6 — Frontend (COMPLETE, Vite build passes, 8 Vitest tests pass)
- PGI branding everywhere (`index.html`, title, logo)
- Zero "Apex Dental", Billing, Reports, Invoice, Payment, formatINR references
- Responsive mobile/tablet drawer sidebar
- **5 role-aware dashboards** — Admin, Doctor (missed patients + pain/severity widgets), Student, Receptionist, Patient Portal
- **Patient Directory** — multi-category checkboxes, keyword/age/severity filters, CR Number display
- **Patient Detail (EMR)** — Priority Demographics, disease-category X-ray date-wise links, Share with Patient toggle
- **PerioChart** — 32-tooth, 6-site (MB/B/DB/ML/L/DL), recession, BOP, mobility, furcation, plaque index; color-coded (≥4mm yellow, ≥6mm red)
- **Surgical Log** modal — `SurgicalLogModal.tsx`
- **Misc Records** tab per disease category
- **Document Gallery** — 6 photo types (intraoral/extraoral/surgery/iop/opg/cbct), privacy badges, `Share with Patient` toggle, raw CBCT viewer
- **Prescription builder** — Auto-Rx template picker, EN/HI/PA language selector, PDF download
- **Smart Calendar** — Doctor view + Operatory view, conflict detection
- **PatientCare hub** — Notifications, Recalls, Preventive Care, Social Media tabs
- **Patient Attendance desk** — Receptionist page
- **Patient Portal** — locked down (appointments + ICS + shared records + prescriptions only)

### Phase 3 Backend Routers (Written, APP_IMPORT_OK)
All new routers are **mounted** in `backend/app/main.py`:
- `backend/app/routers/tracker.py` — `/tracker/overview`, `/tracker/enquiries`, `/tracker/slipping`
- `backend/app/routers/notifications.py` — `/notifications/settings`, `/notifications/logs`, `/notifications/recalls`, `/notifications/preventive-care`
- `backend/app/routers/integrations.py` — `/integrations/social-settings`, `/integrations/whatsapp-link/{id}`
- `backend/app/services/google_calendar_service.py` — ICS RFC 5545, Google Calendar template URLs
- `backend/app/services/notification_service.py` — sandbox SMS/email dispatch, `SMS_SENDER_ID="PGIDNT"`
- `backend/app/i18n/__init__.py` + `translations.py` — full EN/HI/PA strings (43KB)

### Updated Routers (Phase 3–5 additions committed)
- `routers/patients.py` — `scope`, `severity`, `categories`, `keyword`, `age_group` filters; `PATCH /patients/{id}/severity`; card/consent upload; surgical-logs; miscellaneous; shared-notices
- `routers/appointments.py` — calendar view, missed endpoint, ICS download, conflict detection
- `routers/documents.py` — `is_shared_with_patient`, `media_date`, `treatment_stage`, `disease_category`, share toggle
- `routers/prescriptions.py` — templates, instructions library, multilingual `language` field
- `routers/xrays.py` — date-wise X-ray endpoint

---

## 7. What Is NOT Done / Needs Verification ⚠️

### A — PDF Generator (HarfBuzz shaping — HIGH PRIORITY for viva)
**File:** `backend/app/pdf/generator.py`

The HarfBuzz multilingual PDF shaping was **prototyped and verified** (test PNG confirmed correct Devanagari/Gurmukhi rendering), but the production `generator.py` may not have been fully updated to use it. **You must verify:**

```bash
cd backend
.venv/bin/python -c "
from app.pdf.generator import generate_prescription_pdf
print('PDF generator imports OK')
"
```

If it fails or uses plain `TTFont + Paragraph` (which does NOT shape Devanagari), you need to integrate the HarfBuzz approach:

```python
# Required imports in generator.py
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
# Font paths: backend/app/pdf/fonts/NotoSansDevanagari-Regular.ttf etc.
# Use ShapedParagraph flowable with glyph outline paths (NOT Paragraph with TTFont)
```

Both `uharfbuzz==0.57.0` and `fonttools==4.68.0` are **already installed** in `backend/.venv`.

### B — Run the Full Test Suite
```bash
cd backend
.venv/bin/python -c "
from app.database import Base
import app.models
tables = sorted(Base.metadata.tables.keys())
print(tables)
assert len(tables) == 8, f'Expected 8 tables, got {len(tables)}'
print('8-TABLE CHECK PASSED')
"
.venv/bin/python -c "from app.main import app; print('APP_IMPORT_OK')"
rm -f dental.db && .venv/bin/python migrate_db.py && .venv/bin/python seeds/seed_data.py
.venv/bin/ruff check app tests migrate_db.py seeds/seed_data.py
.venv/bin/pytest -v
```

Phase 3–5 tests are in `backend/tests/test_phase3_phase4_phase5.py` — **these have NOT been run yet** after the latest commit. Some may fail if router implementations are incomplete.

### C — Frontend Vite Build Verification
```bash
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
```

The build was passing before the Phase 3 agent's files were merged in. Re-verify after the merge.

### D — Live Browser E2E (Playwright)
E2E test specs exist in `e2e/tests/`:
- `workflow_1_receptionist_booking.spec.ts`
- `workflow_2_dentist_clinical.spec.ts`
- `workflow_4_admin_audit.spec.ts`

To run, start servers first:
```bash
# Terminal 1
cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload

# Terminal 2
npm --prefix frontend run dev  # starts on http://localhost:5173

# Terminal 3
npx playwright test --headed
```

Screenshots should be saved to `qa_screenshots/`.

### E — Rubric Items Not Yet Verified Live
Per `pgi_dental_management_system_requirements.md`, these rubric items need live browser verification:
- **R1** — Zero Billing/Reports nav items in all role views
- **R2** — PGI branding, zero "Apex Dental" anywhere
- **R3** — Admin: Doctors CRUD, Students CRUD (students NOT locked to one doctor)
- **R4** — Doctor Dashboard: missed-patient widget, pain/severity triage widget
- **R6** — Receptionist: Attendance ONLY, 403 on all clinical routes
- **R7** — Patient registration with CR Number, disease categories, keywords, special-case flag
- **R8** — EMR: FDI restorative chart, 6-site perio chart, visit notes, surgical logs
- **R9** — Document upload: 6 photo types + raw CBCT (.dcm/.zip up to 500MB), share toggle
- **R10** — Prescription: EN/HI/PA with Devanagari/Gurmukhi PDF rendering (zero missing-glyph boxes)
- **R11** — Date-wise X-ray links under each disease category in patient detail
- **R12** — Smart Calendar: Doctor view + Operatory view, conflict detection
- **R13** — Patient Portal: sees ONLY appointments + shared records, NOT clinical notes

---

## 8. Architecture Rules (Do Not Violate)

1. **8 tables maximum** — no new SQLAlchemy models/tables ever
2. **Zero billing** — no cost/fee/invoice/payment anywhere
3. **`verify_patient_access` on EVERY patient-data route** — Doctor=all, Student=own only, Receptionist=403
4. **HarfBuzz for Indic PDFs** — `uharfbuzz` + `fonttools` glyph outline paths required; plain `Paragraph + TTFont` does NOT shape Devanagari
5. **AES-256-GCM for all file storage** — always use `file_storage.py`; never write raw files to vault
6. **Student revocation** — `DELETE /students/{id}` must increment `token_version` → instant JWT invalidation
7. **Sandbox mode for integrations** — SMS/Email/Google Calendar work offline; controlled by `.env`

---

## 9. Key File Locations Reference

```
Apex-Dental-Care/
├── pgi_dental_management_system_requirements.md   ← READ FIRST
├── pgi_dental_management_system_implementation_plan.md  ← READ SECOND
├── AI_HANDOUT.md                                  ← THIS FILE
├── backend/
│   ├── app/
│   │   ├── main.py                  ← All routers mounted here
│   │   ├── config.py                ← PGI settings, SMS_SENDER_ID, STORAGE_TYPE
│   │   ├── constants.py             ← FDI teeth, disease categories, procedure catalog
│   │   ├── models/                  ← 8 SQLAlchemy models (DO NOT ADD MORE)
│   │   ├── routers/                 ← All API endpoints
│   │   ├── schemas/                 ← Pydantic request/response models
│   │   ├── services/                ← Business logic
│   │   ├── security/                ← JWT, RBAC, verify_patient_access
│   │   ├── storage/file_storage.py  ← AES-256-GCM vault
│   │   ├── i18n/translations.py     ← EN/HI/PA strings (43KB)
│   │   └── pdf/
│   │       ├── generator.py         ← ⚠️ VERIFY HarfBuzz shaping is integrated
│   │       └── fonts/               ← NotoSans + NotoSansDevanagari + NotoSansGurmukhi TTFs
│   ├── alembic/versions/001_pgi_8_table_schema.py
│   ├── seeds/seed_data.py
│   ├── tests/
│   │   ├── test_phase1_phase2.py    ← 36 tests PASS ✅
│   │   └── test_phase3_phase4_phase5.py  ← ⚠️ NOT YET RUN
│   ├── requirements.txt
│   └── uploads/vault/               ← Encrypted file storage
├── frontend/
│   ├── index.html                   ← "PGI Dental Management System"
│   └── src/
│       ├── App.tsx                  ← All routes + role-based redirects
│       ├── types/index.ts           ← All TypeScript types
│       ├── context/AuthContext.tsx  ← Auth state, is_admin support
│       ├── pages/                   ← Dashboard, Patients, Appointments, etc.
│       │   └── patient/             ← PatientAppointments, Prescriptions, SharedRecords
│       ├── components/
│       │   ├── layout/              ← Sidebar, Header, MainLayout, ProtectedRoute, PatientLayout
│       │   ├── dental/              ← PerioChart, ToothModal, FDIToothChart
│       │   ├── clinical/            ← VisitModal, SurgicalLogModal
│       │   ├── documents/           ← DocumentUploadModal, MediaLightboxModal
│       │   ├── patients/            ← PatientFormModal
│       │   └── common/              ← Modal
│       ├── api/                     ← All API client functions
│       └── utils/formatters.ts      ← SEVERITY_META, getPainColorClass, LANGUAGE_LABELS
└── e2e/tests/                       ← Playwright E2E specs
    ├── workflow_1_receptionist_booking.spec.ts
    ├── workflow_2_dentist_clinical.spec.ts
    └── workflow_4_admin_audit.spec.ts
```

---

## 10. Git Push Status

The commit `cb16c92` is **local only** on branch `pgi-dental-compliance`.

Push was blocked because `AryaA-03` does not have write access to `Aditaya-jpg/Apex-Dental-Care`.

To push, the repo owner (`Aditaya-jpg`) must add `AryaA-03` as a collaborator, then run:
```bash
git push origin pgi-dental-compliance
```

---

## 11. Recommended Next Steps (Priority for Viva Demo)

1. **Verify & fix `pdf/generator.py`** — integrate HarfBuzz shaping (highest viva risk)
2. **Run `pytest -v`** — fix any failing Phase 3–5 tests
3. **Run `npm run build`** in frontend — fix any TypeScript errors from merged files
4. **Seed fresh DB** — `rm -f backend/dental.db && python migrate_db.py && python seeds/seed_data.py`
5. **Start both servers** and do a quick manual smoke test of all 5 roles
6. **Run Playwright E2E** specs for automated verification
7. **Resolve git push** — get collaborator access or push to fork

---

*Generated: 2026-11-25 | Branch: `pgi-dental-compliance` | Commit: `cb16c92`*
