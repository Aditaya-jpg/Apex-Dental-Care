# PGI Dental Management System - Quality Assurance & Testing Strategy

The **PGI Dental Management System** employs a comprehensive, multi-tiered testing strategy covering unit logic, 8-table database invariants, AES-256-GCM vault security, RBAC & instant revocation, HarfBuzz Indic PDFs, component rendering, and end-to-end browser workflows.

```
       /\
      /  \     End-to-End Tests (Playwright)
     /----\    Full Role, Portal & Responsive Workflows
    /      \
   /--------\   Integration & Security Tests (41 Pytest Cases + HTTPX)
  /          \  8-Table Check, AES-GCM Vault, RBAC, Revocation, i18n PDFs
 /------------\
/   Unit Tests \ Unit & Component Tests (Vitest 8 Cases + tsc + vite build)
----------------
```

---

## 1. Automated Test Suites Summary

| Test Suite | Framework | Scope / Components Tested |
|---|---|---|
| **Backend Unit & Integration** | Pytest + HTTPX (`41 tests`) | Locked 8-table schema, zero billing/reports check, auth & refresh rotation, AES-256-GCM CBCT vault, student isolation & instant JWT revocation, receptionist attendance-only, patient portal privacy, CR registration, disease segregation, date-wise X-rays, tracker/enquiries, perio/surgical/misc/notices, EN/HI/PA HarfBuzz PDFs, smart calendar & `.ics`, recalls, preventive care, social webhooks. |
| **Backend Security & RBAC** | Pytest | Role boundary enforcement, receptionist denied clinical edits, doctor denied admin operations, student cross-patient 403, SQL injection payloads, path traversal & magic-byte upload checks. |
| **Frontend Unit & Components** | Vitest + React Testing Library (`8 tests`) | `FDIToothChart` 32 permanent teeth rendering & condition updates; `RBAC` & `ProtectedRoute` role gates across PGI roles. |
| **End-to-End (E2E)** | Playwright | Browser verification across Receptionist, Doctor, Admin-Doctor, Student, Admin, and Patient Portal workflows + `1440px`/`768px`/`390px` viewports. |

---

## 2. Executing Backend Tests

The backend test suite executes **41 comprehensive test cases** against the locked 8-table schema and seed fixtures.

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Run full test suite with verbose output
.venv/bin/pytest -v

# Run with test coverage report
.venv/bin/pytest --cov=app --cov-report=term-missing
```

### Key Security & Clinical Test Cases Tested:
- `test_strictly_8_tables_and_sqlite_foreign_keys` & `test_no_billing_or_reports_endpoints`: Enforces locked 8-table schema and zero billing routes.
- `test_aes256_gcm_chunked_vault_cbct_and_magic_validation`: Validates `PGIV1` chunked encryption, CBCT support, and magic-byte rejection.
- `test_student_flexible_pool_isolation_and_instant_revocation` & `test_student_revoke_endpoint`: Confirms unassigned pool support, cross-student isolation, and immediate JWT invalidation via `token_version`.
- `test_receptionist_attendance_only` & `test_patient_portal_privacy_and_opt_in_sharing`: Confirms strict role isolation.
- `test_fdi_permanent_teeth_initialization` & `test_fdi_invalid_tooth_number`: Verifies 32 FDI teeth (`11–48`) and 422 rejection of invalid tooth numbers.
- `test_phase4_visits_perio_surgical_misc_notices_and_media` & `test_phase4_multilingual_prescriptions_instructions_and_harfbuzz_pdfs`: Verifies 6-site Perio, Surgical Logs, and EN/HI/PA HarfBuzz PDF generation.
- `test_phase5_calendar_ics_notifications_recalls_preventive_and_social`: Verifies Smart Calendar, `.ics`, `PGIDNT` notifications, recalls, preventive care, and social leads.

---

## 3. Executing Frontend Tests

Frontend tests verify component state, anatomical SVG tooth charting, and client-side route access control.

```bash
cd frontend

# Run Vitest test runner
npm test

# Run tests in watch mode
npx vitest
```

---

## 4. Executing End-to-End (E2E) Browser Tests

Playwright tests execute the 4 mandatory production workflows in headless or headed Chromium:

```bash
# Ensure backend and frontend are running or run via docker-compose
docker compose up -d

# Run Playwright test suite
cd e2e
npx playwright test

# View interactive HTML test report
npx playwright show-report
```

### Key Workflows Verified:
1. **Workflow 1 (`workflow_1_receptionist_booking.spec.ts`):** Receptionist login → lands on `/attendance` → sidebar isolation & `/patients` blocked.
2. **Workflow 2 (`workflow_2_dentist_clinical.spec.ts`):** Doctor login → Patient Dossier → FDI Dental Chart & Perio Chart → Treatment Plans & Surgical Logs → Multilingual Prescriptions.
3. **Workflow 4 (`workflow_4_admin_audit.spec.ts`):** Admin login → Audit Logs → PGI Staff & User Accounts.
4. **Full Multi-Role & Portal Live Suite:** Verified across Admin, Admin-Doctor, Doctor, Student isolation, Receptionist, Patient Portal (Appointments / Prescriptions & Care Instructions / Shared Records), and `1440px` / `768px` / `390px` viewports.
