# PGI Dental Management System — Oral Health Sciences Centre, PGIMER Chandigarh

[![CI/CD Pipeline](https://github.com/apex-dental/clinic-system/actions/workflows/ci.yml/badge.svg)](https://github.com/apex-dental/clinic-system/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg?logo=typescript)](https://www.typescriptlang.org)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-d71f00.svg)](https://www.sqlalchemy.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **PGI Dental Management System** is a **role-based clinical electronic dental record (EDR), scheduling, encrypted imaging vault, and multilingual patient care platform** built for the **PGI Dental Branch — Oral Health Sciences Centre, PGIMER Chandigarh**. Designed around a strictly clinical and academic workflow (zero billing/invoices/payments) and a locked 8-table schema, it unifies doctor, trainee student, reception attendance, and privacy-isolated patient portal workflows.

---

## 🌟 Key Features & Clinical Capabilities

1. **FDI Two-Digit World Dental Federation Charting (11–48):**
   - Full anatomical 32-tooth permanent dentition covering all 4 quadrants (Maxilla & Mandible).
   - Multi-surface condition tracking (Mesial, Distal, Occlusal, Buccal, Lingual).
   - Clinical statuses: Healthy, Caries, Filled, Crown, Root Canal, Missing, Extraction, Fracture, Sensitivity, Mobility, Bridge, Implant.
   - Preserves complete immutable clinical tooth history across visits.

2. **Patient Registration & Longitudinal 11-Tab Clinical Dossier:**
   - CR Number, demographics, Aadhaar/registration card & signed consent upload, pain scale (0–10), triage severity, special-case flag, 10 canonical disease categories, and case keywords.
   - Tabbed records: FDI Dental Chart (with 6-site Periodontal Chart), Examinations & Visits, Treatment Plans (with Surgical Logs), Prescriptions, X-rays (3D), Clinical Media & Photos, Miscellaneous, Appointments, Follow-ups, Medical/Dental History, and Event Timeline.

3. **Smart Calendar & Conflict-Free Appointment Scheduling:**
   - Multi-mode **Smart Calendar** (**Doctor View** & **Operatory View**) with real-time double-booking prevention.
   - Google Calendar links, RFC 5545 `.ics` downloads, missed-appointment tracking, and status transitions (`scheduled` → `confirmed` → `completed` / `cancelled` / `no_show`).

4. **Clinical Examination & 6-Site Periodontal Charting:**
   - Vital signs recording, chief complaints, and oral findings.
   - Interactive 32-tooth, 6-site Periodontal Chart (`MB`, `B`, `DB`, `ML`, `L`, `DL`) with pocket-depth color coding (≥ 4 mm amber / ≥ 6 mm rose), recession, BOP, mobility (`0`/`I`/`II`/`III`), furcation, and plaque index.

5. **Multi-Procedure Care Plans & Surgical Logs (Cost-Free):**
   - Multi-stage clinical treatment plans without billing or fees.
   - Dedicated Surgical Logs tracking procedure name, `tooth_numbers`, surgeon, anesthesia, operative notes, post-op instructions, and suture removal date.
   - Progress tracking: `planned` → `in_progress` → `completed`.

6. **Multilingual Prescriptions & HarfBuzz PDF Generation (EN / HI / PA):**
   - Auto-Rx clinical templates, dental pharmacy formulary, and localized pre/post-treatment instructions in **English**, **Hindi**, and **Punjabi**.
   - Dynamic translation (`translate_clinical_text`) automatically translates arbitrary diagnosis summaries, general advice, care instructions, and custom medication notes into Hindi/Punjabi with in-memory caching and safe offline fallback.
   - Official vector PDF generated via ReportLab with `uharfbuzz` + `fonttools` OpenType shaping and bundled Noto Sans / Devanagari / Gurmukhi fonts.

7. **Patient Care Hub, Recalls & Privacy-Isolated Patient Portal:**
   - Localized SMS/Email alerts (default `SMS_SENDER_ID="PGIDNT"`), Automatic Recalls (`7d` suture, `14d` crown, `30d` RCT, `90d` perio, `6-month` checkup), Preventive Care campaigns, and Social Media intake webhooks.
   - **Patient Portal** (`/portal/*`) showing only appointments, `.ics`/Google Calendar links, prescriptions & care instructions, and explicitly opt-in shared records.

8. **AES-256-GCM Encrypted Document, Media & CBCT Vault:**
   - Chunked `PGIV1` AES-256-GCM storage for 6 clinical photo types (`intraoral`, `extraoral`, `surgery`, `iop`, `opg`, `cbct`) and raw CBCT scans up to **500 MB** (`25 MB` standard files).
   - Magic-byte verification, SHA-256 checksums, blocked executable extensions, date-wise category X-ray links, lightbox preview, and `Share with Patient` toggle.

9. **Centralized Compliance, Audit & Instant Trainee Revocation:**
   - Immutable audit trail recording user, action, target entity, timestamp, IP address, and client headers with recursive secret sanitization.
   - Flexible student pool (`doctor_id` nullable) with instant JWT invalidation (`token_version` + `revoked_at`) on student removal.

10. **Role-Aware Dashboards & Patient Tracker:**
    - Live KPIs: Total Patients, Appointments Today, Missed Appointments Triage, Pain/Severity Triage, and Follow-ups Due.
    - Recharts visual analytics (disease category breakdown, appointment status distributions, doctor activity) and Patient Tracker pipeline + social enquiry conversion.

11. **Oral-3D Deep Learning 3D Teeth & X-Ray Suite (Doctor Portal):**
    - Seamless AI-powered reconstruction of interactive 3D teeth, jawbone, and arch structure from standard 2D panoramic radiographs (OPGs).
    - WebGL 3D Viewport with OrbitControls, anatomical angle presets, and 5 clinical shaders (Enamel Bone, CT Heatmap, Wireframe, Surface Normals, Translucent X-Ray).
    - Multi-Planar Reconstruction (MPR) orthogonal cross-section scrubbers (Axial, Coronal, Sagittal).
    - Clinical dental arch biometrics: Arch Width, Depth, Height (mm) and Hard Volume (cm³).
    - 3D Model export center: Watertight STL (3D Printing / Aligners), OBJ (CAD / Exocad), GLB (Web / AR), and NIfTI (`.nii.gz`).
    - Longitudinal patient file storage: 3D models and findings attach directly to the patient's record under the **X-rays (3D)** tab.
    - For full architecture, neural pipeline, and paper citations, see [ORAL_3D_README.md](./ORAL_3D_README.md).

---

## 🏗️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query v5, React Router v6, Lucide Icons, Recharts |
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 (`ConfigDict`), SQLAlchemy 2.x, Alembic |
| **Database** | MySQL 8.0 (Production) / SQLite (Local Dev/Testing) — Locked 8-Table Schema |
| **Authentication** | JWT Access Tokens + Refresh Token Rotation, `token_version` Instant Revocation, Bcrypt |
| **Document Engine** | ReportLab 4.x + `uharfbuzz` + `fonttools` (Noto Sans EN/HI/PA Multilingual PDFs) |
| **Infrastructure** | Docker, Docker Compose, Nginx (Alpine), Multi-stage builds |
| **Testing** | Pytest, Pytest-Asyncio, HTTPX, Vitest, React Testing Library, Playwright E2E |

---

## 🚀 Quick Start with Docker

The entire platform (MySQL 8, FastAPI backend, and Nginx React frontend) can be spun up with one command:

```bash
# 1. Clone repository
git clone https://github.com/apex-dental/clinic-system.git
cd clinic-system

# 2. Start all services via Docker Compose
docker compose up --build
```

Once started:
- **Web Application Portal:** [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **FastAPI Health Endpoint:** [http://localhost:8000/api/v1/health/ready](http://localhost:8000/api/v1/health/ready)

---

## 💻 Local Development Setup

### One-Command Launcher (macOS / Linux / Windows)

```bash
# macOS / Linux (creates backend .venv & installs deps automatically if missing):
./start.sh

# Windows:
start.bat
```

### 1. Backend Setup

```bash
cd backend

# Create and activate python virtual environment
python3 -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify/create 8-table database schema
python migrate_db.py

# Seed PGI Dental demo database
python seeds/seed_data.py

# Launch development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Launch Vite development server
npm run dev
```

Frontend will run at [http://localhost:3000](http://localhost:3000) with automatic hot-module reloading and API proxying to port 8000.

---

## 🔑 Demo User Credentials

The database seeder pre-populates the platform with realistic clinical records and staff accounts:

| Role | Email | Password | Access & Notes |
|---|---|---|---|
| **Administrator** | `admin@pgi.edu.in` | `Dental@123` | Full system & branch administration |
| **Admin Doctor** | `dr.mehta@pgi.edu.in` | `Dental@123` | Doctor with `is_admin=True` (clinical + admin access) |
| **Doctor** | `dr.sharma@pgi.edu.in` | `Dental@123` | Branch-wide patient & clinical access |
| **Doctor** | `dr.kaur@pgi.edu.in` | `Dental@123` | Branch-wide patient & clinical access |
| **Student Trainee** | `student1@pgi.edu.in` .. `student6@pgi.edu.in` | `Dental@123` | Isolated to assigned patients (`student4–5` unassigned pool) |
| **Receptionist** | `reception@pgi.edu.in` | `Dental@123` | Attendance & walk-in check-in desk only |
| **Patient Portal** | `patient@pgi.edu.in` | `Dental@123` | Portal user linked to Patient #1 (Aarav Sharma) |

> ⚠️ **Security Notice:** The above credentials are provided exclusively for evaluation and demo environments. Production environments must change all passwords and rotate JWT secrets immediately upon initialization.

---

## 🧪 Testing Suites

### Backend Tests (41 automated tests)
```bash
cd backend
.venv/bin/pytest -v
```

### Frontend Tests (Vitest + React Testing Library)
```bash
cd frontend
npm test
```

### End-to-End Tests (Playwright)
```bash
cd e2e
npx playwright test
```

---

## 📁 Repository Structure

```
├── backend/
│   ├── alembic/                # Database migration scripts
│   ├── app/
│   │   ├── audit/              # Centralized audit logger & payload sanitizer
│   │   ├── models/             # SQLAlchemy 2.0 ORM entity models
│   │   ├── pdf/                # ReportLab vector PDF generators
│   │   ├── routers/            # FastAPI REST endpoints
│   │   ├── schemas/            # Pydantic v2 schemas
│   │   ├── security/           # JWT, Bcrypt, and RBAC permissions matrix
│   │   ├── services/           # Business logic service layer
│   │   ├── storage/            # Secure local/S3 file storage abstraction
│   │   ├── config.py           # Pydantic Settings configuration
│   │   ├── database.py         # SQLAlchemy engine & session management
│   │   └── main.py             # FastAPI application entrypoint & middlewares
│   ├── seeds/                  # Realistic clinical demo seeder
│   ├── tests/                  # Pytest automated test suites
│   ├── Dockerfile              # Backend container build
│   └── requirements.txt        # Python dependency manifest
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios/Fetch typed REST API clients
│   │   ├── components/         # Modals, layout, and FDI tooth chart
│   │   ├── context/            # AuthContext & Session management
│   │   ├── pages/              # 10 primary module views
│   │   ├── test/               # Vitest component & RBAC test specs
│   │   ├── types/              # Comprehensive TypeScript interfaces
│   │   ├── App.tsx             # React Router v6 & QueryClient configuration
│   │   └── main.tsx            # DOM root entrypoint
│   ├── nginx.conf              # Production Nginx reverse proxy configuration
│   ├── Dockerfile              # Multi-stage frontend container build
│   └── package.json            # Node.js dependencies
├── e2e/                        # Playwright E2E test workflows
├── .github/workflows/ci.yml    # Full GitHub Actions CI/CD pipeline
├── docker-compose.yml          # Multi-container orchestration
└── .env.example                # Environment variable configuration template
```

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
