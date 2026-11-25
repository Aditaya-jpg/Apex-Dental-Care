# PGI Dental Management System - System Architecture Document

## 1. Architectural Philosophy & Overview

The **PGI Dental Management System** (Oral Health Sciences Centre, PGIMER Chandigarh) is architected as a **stateless, modular monolith**. The system decouples presentation, orchestration, and persistence into clear architectural layers, ensuring that business logic, RBAC patient isolation, and AES-256-GCM media encryption are strictly enforced in backend services.

```mermaid
graph TD
    Client["React 18 SPA (Vite + TypeScript)"]
    Nginx["Nginx Reverse Proxy & Static Host"]
    FastAPI["FastAPI REST Application Layer"]
    Middlewares["Security Headers & Correlation Middlewares"]
    Routers["21 REST Routers (/patients, /dental-chart, /patient-portal, etc.)"]
    Services["Service Layer (RBAC Scoping, Conflicts, Recalls, GCal)"]
    ORM["SQLAlchemy 2.0 ORM (Locked 8-Table Schema)"]
    Database[("MySQL 8.0 / SQLite Relational DB")]
    FileVault[("AES-256-GCM Chunked File Vault (PGIV1)")]
    PDFEngine["ReportLab + uharfbuzz Multilingual PDF Engine"]
    AuditService["Centralized Audit & Care Log Service"]

    Client -->|HTTPS / API Requests| Nginx
    Nginx -->|Proxy Pass| FastAPI
    FastAPI --> Middlewares
    Middlewares --> Routers
    Routers --> Services
    Services --> ORM
    Services --> PDFEngine
    Services --> FileVault
    Services --> AuditService
    ORM --> Database
    AuditService --> Database
```

---

## 2. Layered Backend Design

The backend enforces strict separation of concerns across 5 distinct tiers:

### 1. Delivery Tier (`app/routers/`)
- Pure HTTP handling: Parameter deserialization, request schema validation, status code assignment, and content negotiation.
- Implements dependency injection for user authentication (`get_current_user`) and RBAC verification (`require_roles`).
- Zero direct database mutations or business calculations occur within routers.

### 2. Service Tier (`app/services/`)
- Contains 100% of domain business logic.
- Atomic business transactions, conflict detection (doctor & operatory double-booking), automatic recalls, Google Calendar `.ics` generation, and tooth/perio condition history creation.
- Explicit transactional scope management with automated rollbacks on failure.

### 3. Model & Persistence Tier (`app/models/` & `app/database.py`)
- Declarative SQLAlchemy 2.0 ORM entity definitions locked to **strictly 8 tables** (`doctors`, `students`, `patients`, `users`, `appointments`, `clinical_records`, `documents`, `care_and_system_logs`).
- Explicit foreign keys (`ON DELETE SET NULL` for flexible academic pool assignments), JSON payload columns (`payload_json`, `dental_chart_json`, `perio_chart_json`, `misc_records_json`), soft-delete flags (`is_deleted`), and timestamp tracking (`created_at`, `updated_at`).

### 4. Security Tier (`app/security/`)
- Cryptographic password hashing using Bcrypt.
- JWT access token minting with `token_version` & `revoked_at` validation for instant student/staff revocation.
- Cryptographically random refresh token rotation with SHA-256 hash storage.
- Declarative role-permission matrix (`require_roles`) and `verify_patient_access` scoping.

### 5. Cross-Cutting Utilities (`app/audit/`, `app/pdf/`, `app/storage/`, `app/i18n/`)
- **Centralized Audit Logger:** Captures mutating events in `care_and_system_logs` with recursive sensitive-data sanitization.
- **HarfBuzz + ReportLab PDF Generator:** Shapes English, Hindi (Devanagari), and Punjabi (Gurmukhi) prescriptions using `uharfbuzz` + `fonttools` glyph paths with bundled Noto fonts.
- **AES-256-GCM Storage Vault (`PGIV1`):** Protects uploads with 1 MB chunked AEAD encryption, magic-byte verification, SHA-256 checksums, and up to 500 MB CBCT streaming.

---

## 3. Frontend Architecture

The frontend is built on React 18, TypeScript, and Vite, prioritizing predictable state management and minimal re-renders:

```mermaid
graph LR
    subgraph UI Components
        Pages["Pages (e.g. PatientDetail.tsx)"]
        Components["Feature Modals & Components"]
        Chart["FDI Anatomical SVG Chart (11-48)"]
    end

    subgraph State Management
        Auth["AuthContext (JWT & Current User)"]
        Query["TanStack Query Cache (Server State)"]
        Forms["React Hook Form + Zod (Form State)"]
    end

    subgraph Network Layer
        ApiClient["Axios / Fetch Client (/api/v1)"]
        Interceptors["Auth Interceptor (Bearer Token & 401 Refresh)"]
    end

    Pages --> Components
    Components --> Chart
    Components --> Forms
    Pages --> Query
    Pages --> Auth
    Query --> ApiClient
    ApiClient --> Interceptors
```

### Server State vs Local UI State
- **Server State:** Managed exclusively through `@tanstack/react-query` with declarative query keys (e.g. `['patient', id]`, `['treatmentPlans', status]`). Mutations invalidate corresponding cache keys to trigger re-renders without manual state synchronization.
- **Form State:** Managed with controlled inputs and strict validation schemas.
- **Global Context:** Reserved strictly for authentication session tokens and active user profile.

---

## 4. Clinical Workflow Sequences

### Appointment & Examination Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Receptionist
    actor Dentist
    participant ApptService as Appointment Service
    participant VisitService as Clinical Visit Service
    participant DentalService as FDI Dental Chart Service
    participant DB as Relational Database

    Receptionist->>ApptService: Book Appointment (patient_id, dentist_id, date, start_time)
    ApptService->>DB: Query Overlapping Appointments for Dentist
    alt Conflict Exists
        ApptService-->>Receptionist: 409 Conflict Error
    else Slot Available
        ApptService->>DB: Insert Appointment (status='scheduled')
        ApptService-->>Receptionist: Appointment Confirmed
    end

    Dentist->>VisitService: Start Visit (appointment_id, patient_id)
    VisitService->>DB: Insert Visit & Update Appointment status='completed'
    Dentist->>DentalService: Update Tooth 16 Condition (condition='caries', severity='moderate')
    DentalService->>DB: Update Current Tooth 16 & Insert Tooth History Record
    DentalService-->>Dentist: Updated Tooth Chart State
```

---

## 5. Security & Isolation Boundaries

1. **Network Boundary:** The database (`apex_dental_mysql`) is placed in an internal Docker network and is inaccessible from the public internet.
2. **Access Boundary:** Reverse proxy (Nginx) terminates external HTTP requests and applies security headers before forwarding traffic to the application server.
3. **Application Boundary:** Every route verifies authentication (valid JWT signature, unexpired token, matching `token_version`, and unrevoked `Student.revoked_at`), role authorization (`require_roles`), and patient scope (`verify_patient_access` / Patient Portal self-only isolation).
