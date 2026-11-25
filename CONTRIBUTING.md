# Contributing to PGI Dental Management System

Thank you for your interest in contributing to the **PGI Dental Management System** (Oral Health Sciences Centre, PGIMER Chandigarh). As a healthcare software platform handling sensitive patient records, all code contributions must satisfy strict security, test coverage, and design standards.

---

## 1. Development Principles

1. **Defense in Depth:** Never trust client-side validation alone. Every endpoint must enforce server-side validation, `require_roles(...)`, and `verify_patient_access(...)`.
2. **Clinical Safety Boundary:** The platform is a clinical record and management system. Autonomous medical or dental diagnosis without clinician oversight is strictly out of scope.
3. **Locked 8-Table & Zero-Billing Invariant:** Never add a 9th SQLAlchemy model/table or reintroduce billing, invoice, fee, or payment endpoints.
4. **Zero Regressions:** Every PR must include corresponding automated tests (Pytest for backend, Vitest for frontend, or Playwright for workflows).

---

## 2. Coding Standards

### Backend (Python / FastAPI)
- Formatted and linted using `ruff`:
  ```bash
  cd backend
  ruff check .
  ruff format .
  ```
- All schema models must use Pydantic v2 conventions (`model_config = ConfigDict(from_attributes=True)`).
- ORM entities must inherit from `Base` with explicit indexes and foreign key cascades.

### Frontend (React / TypeScript)
- Strict mode enabled (`strict: true`).
- Formatted with Prettier and Tailwind CSS class order.
- Verify TypeScript types without emitting:
  ```bash
  cd frontend
  npm run lint
  ```

---

## 3. Pull Request Checklist

Before submitting a PR, verify:
- [ ] Backend tests pass: `.venv/bin/pytest -v` (in `backend/`, 41 tests)
- [ ] Frontend tests pass: `npm run test` (in `frontend/`, 8 tests)
- [ ] Frontend typecheck & build succeed cleanly: `npm run lint && npm run build` (in `frontend/`)
- [ ] No secrets, encryption keys, or passwords committed.
- [ ] Database schema remains 8 tables (`python migrate_db.py`).
- [ ] Centralized audit logging is added for new mutating operations.
