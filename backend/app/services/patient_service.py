from datetime import date
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.patient import (
    DentalHistoryResponse,
    MedicalHistoryResponse,
    PatientCreate,
    PatientDetailResponse,
    PatientUpdate,
)
from app.security.dependencies import (
    resolve_doctor_for_user,
    resolve_student_for_user,
    verify_patient_access,
)


def to_patient_detail(patient: Patient) -> PatientDetailResponse:
    med = patient.medical_history_json or {}
    dent = patient.dental_history_json or {}
    resp = PatientDetailResponse.model_validate(patient)
    resp.medical_history = MedicalHistoryResponse(patient_id=patient.id, **med) if med else MedicalHistoryResponse(patient_id=patient.id)
    resp.dental_history = DentalHistoryResponse(patient_id=patient.id, **dent) if dent else DentalHistoryResponse(patient_id=patient.id)
    return resp


class PatientService:
    @staticmethod
    def _generate_patient_code(db: Session) -> str:
        """Generate a sequential unique patient ID like P-1001, P-1002."""
        max_id = db.query(func.max(Patient.id)).scalar() or 0
        code_num = 1001 + max_id
        while db.query(Patient).filter(Patient.patient_code == f"P-{code_num}").first():
            code_num += 1
        return f"P-{code_num}"

    @staticmethod
    def _generate_cr_number(db: Session) -> str:
        max_id = db.query(func.max(Patient.id)).scalar() or 0
        cr_num = 1001 + max_id
        while db.query(Patient).filter(Patient.cr_number == f"PGI-CR-{cr_num}").first():
            cr_num += 1
        return f"PGI-CR-{cr_num}"

    @classmethod
    def create_patient(
        cls,
        db: Session,
        data: PatientCreate,
        current_user: User,
        request: Request | None = None,
    ) -> Patient:
        """Register a new patient with PGI CR Number, flexible Student/Doctor assignment, and JSON clinical history."""
        patient_code = cls._generate_patient_code(db)

        existing_phone = db.query(Patient).filter(Patient.phone == data.phone, Patient.is_deleted == False).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DUPLICATE_PHONE", "message": f"A patient with phone {data.phone} already exists."},
            )

        if data.cr_number:
            existing_cr = db.query(Patient).filter(Patient.cr_number == data.cr_number, Patient.is_deleted == False).first()
            if existing_cr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "DUPLICATE_CR_NUMBER", "message": f"A patient with CR Number {data.cr_number} already exists."},
                )
            cr_num = data.cr_number.strip()
        else:
            cr_num = cls._generate_cr_number(db)

        doc_id = data.doctor_id
        stu_id = data.student_id

        if current_user.role in ("dentist", "doctor"):
            doc = resolve_doctor_for_user(db, current_user)
            if doc_id is None and doc:
                doc_id = doc.id
            if stu_id is not None:
                student = db.query(Student).filter(
                    Student.id == stu_id,
                    Student.is_active == True,
                    Student.revoked_at.is_(None),
                ).first()
                if not student:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={"code": "INVALID_STUDENT", "message": "Assigned student does not exist or is inactive."},
                    )
        elif current_user.role == "student":
            student = resolve_student_for_user(db, current_user)
            if not student:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "STUDENT_NOT_FOUND", "message": "No active student record associated with this account."},
                )
            stu_id = student.id
            if doc_id is None:
                doc_id = student.doctor_id
        elif current_user.role == "admin":
            if stu_id is not None:
                student = db.query(Student).filter(
                    Student.id == stu_id,
                    Student.is_active == True,
                    Student.revoked_at.is_(None),
                ).first()
                if not student:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={"code": "INVALID_STUDENT", "message": "Assigned student does not exist or is inactive."},
                    )
        if doc_id is not None:
            doc = db.query(Doctor).filter(Doctor.id == doc_id).first()
            if not doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doc_id} not found."},
                )

        # Compute minor consent default if DOB < 18 years
        today = date.today()
        age = today.year - data.date_of_birth.year - (
            (today.month, today.day) < (data.date_of_birth.month, data.date_of_birth.day)
        )
        consent_required = data.parent_consent_required or age < 18 or data.special_case_flag
        consent_status = data.parent_consent_status
        if consent_required and consent_status == "not_required":
            consent_status = "pending"

        med_json = data.medical_history.model_dump() if data.medical_history else {
            "allergies": None,
            "medical_conditions": None,
            "current_medications": None,
            "past_surgeries": None,
            "bleeding_disorders": False,
            "is_pregnant": False,
            "notes": None,
        }
        dent_json = data.dental_history.model_dump() if data.dental_history else {
            "chief_complaint": None,
            "past_dental_treatments": None,
            "brushing_frequency": "Twice daily",
            "flossing": False,
            "habits": None,
            "dental_anxiety_level": "None",
            "notes": None,
        }

        full_name = f"{data.first_name.strip()} {data.last_name.strip()}".strip()
        new_patient = Patient(
            patient_code=patient_code,
            cr_number=cr_num,
            full_name=full_name,
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            phone=data.phone.strip(),
            email=data.email,
            address=data.address,
            emergency_contact_name=data.emergency_contact_name,
            emergency_contact_phone=data.emergency_contact_phone,
            blood_group=data.blood_group,
            preferred_language=data.preferred_language,
            doctor_id=doc_id,
            student_id=stu_id,
            disease_categories=data.disease_categories or [],
            case_keywords=data.case_keywords or [],
            special_case_flag=data.special_case_flag,
            pain_scale=data.pain_scale,
            severity_level=data.severity_level,
            parent_consent_required=consent_required,
            parent_guardian_name=data.parent_guardian_name,
            parent_guardian_phone=data.parent_guardian_phone,
            parent_consent_status=consent_status,
            card_verification_status=data.card_verification_status or "pending",
            medical_history_json=med_json,
            dental_history_json=dent_json,
            dental_chart_json={},
            perio_chart_json={},
            misc_records_json={},
            patient_shared_notices_json=[],
            tracker_stage=data.tracker_stage or "registered",
            source_channel=data.source_channel or "walk_in",
            is_deleted=False,
        )
        db.add(new_patient)
        db.commit()
        db.refresh(new_patient)

        log_audit_event(
            db=db,
            action="CREATE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(new_patient.id),
            patient_id=new_patient.id,
            details={
                "patient_code": new_patient.patient_code,
                "name": new_patient.full_name,
                "doctor_id": new_patient.doctor_id,
                "student_id": new_patient.student_id,
                "cr_number": new_patient.cr_number,
            },
            request=request,
        )

        return new_patient

    @staticmethod
    def get_patients_paginated(
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        current_user: User | None = None,
        doctor_id: int | None = None,
        student_id: int | None = None,
        scope: str = "all",
        categories: str | None = None,
        keyword: str | None = None,
        age_group: str | None = None,
        special_case: bool | None = None,
        severity: str | None = None,
    ) -> tuple[list[Patient], int]:
        """
        Search and paginate patients:
        - Admin & Doctor: unrestricted branch-wide visibility across ALL patients (optional scope=mine).
        - Student: STRICTLY isolated to Patient.student_id == current_student.id regardless of scope/params.
        """
        query = db.query(Patient).filter(Patient.is_deleted == False)

        if current_user:
            if current_user.role == "student":
                student = resolve_student_for_user(db, current_user)
                query = query.filter(Patient.student_id == (student.id if student else 0))
            elif current_user.role in ("dentist", "doctor") and scope == "mine":
                doc = resolve_doctor_for_user(db, current_user)
                if doc:
                    query = query.filter(Patient.doctor_id == doc.id)

        if doctor_id is not None:
            query = query.filter(Patient.doctor_id == doctor_id)
        if student_id is not None and (not current_user or current_user.role != "student"):
            query = query.filter(Patient.student_id == student_id)
        if special_case is not None:
            query = query.filter(Patient.special_case_flag == special_case)
        if severity:
            query = query.filter(Patient.severity_level == severity)

        if search:
            st = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Patient.patient_code.ilike(st),
                    Patient.full_name.ilike(st),
                    Patient.first_name.ilike(st),
                    Patient.last_name.ilike(st),
                    Patient.phone.ilike(st),
                    Patient.cr_number.ilike(st),
                )
            )

        rows = query.order_by(desc(Patient.created_at), desc(Patient.id)).all()

        # Portable JSON & computed age filtering (works identically across SQLite & MySQL)
        cat_list = [c.strip().lower() for c in categories.split(",") if c.strip()] if categories else []
        kw_lower = keyword.strip().lower() if keyword else None

        filtered: list[Patient] = []
        for p in rows:
            if cat_list:
                p_cats = [str(c).lower() for c in (p.disease_categories or [])]
                if not any(c in p_cats for c in cat_list):
                    continue
            if kw_lower:
                haystack = " ".join([
                    *(str(k) for k in (p.case_keywords or [])),
                    *(str(c) for c in (p.disease_categories or [])),
                    str((p.medical_history_json or {}).get("medical_conditions") or ""),
                    str((p.dental_history_json or {}).get("habits") or ""),
                    p.full_name,
                    p.cr_number or "",
                ]).lower()
                if kw_lower not in haystack:
                    continue
            if age_group:
                if age_group == "pediatric" and p.age >= 18:
                    continue
                if age_group == "adult" and (p.age < 18 or p.age >= 60):
                    continue
                if age_group == "geriatric" and p.age < 60:
                    continue
            filtered.append(p)

        total = len(filtered)
        start = (page - 1) * page_size
        return filtered[start : start + page_size], total

    @staticmethod
    def get_patient_by_id(db: Session, patient_id: int, current_user: User | None = None) -> Patient:
        if current_user is not None:
            return verify_patient_access(db, current_user, patient_id)
        patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_deleted == False).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PATIENT_NOT_FOUND", "message": f"Patient with ID {patient_id} does not exist."},
            )
        return patient

    @staticmethod
    def update_patient(
        db: Session,
        patient_id: int,
        data: PatientUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> Patient:
        """Update patient demographics, assignment, disease categories, consent, or clinical history."""
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        update_dict = data.model_dump(exclude_unset=True)

        if current_user.role == "student":
            update_dict.pop("doctor_id", None)
            update_dict.pop("student_id", None)
        else:
            if "student_id" in update_dict:
                target_student_id = update_dict.get("student_id")
                if target_student_id is not None:
                    student = db.query(Student).filter(
                        Student.id == target_student_id,
                        Student.is_active == True,
                        Student.revoked_at.is_(None),
                    ).first()
                    if not student:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={"code": "INVALID_STUDENT", "message": "Assigned student does not exist or is inactive."},
                        )
                    patient.student_id = student.id
                else:
                    patient.student_id = None
                update_dict.pop("student_id", None)

            if "doctor_id" in update_dict:
                target_doc_id = update_dict.get("doctor_id")
                if target_doc_id is not None:
                    doc = db.query(Doctor).filter(Doctor.id == target_doc_id).first()
                    if not doc:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor {target_doc_id} not found."},
                        )
                    patient.doctor_id = doc.id
                else:
                    patient.doctor_id = None
                update_dict.pop("doctor_id", None)

        med_data = update_dict.pop("medical_history", None)
        dent_data = update_dict.pop("dental_history", None)

        for k, v in update_dict.items():
            if hasattr(patient, k):
                setattr(patient, k, v)

        if "first_name" in update_dict or "last_name" in update_dict:
            patient.full_name = f"{patient.first_name} {patient.last_name}".strip()

        if med_data is not None:
            merged_med = dict(patient.medical_history_json or {})
            for mk, mv in med_data.items():
                if mv is not None:
                    merged_med[mk] = mv
            patient.medical_history_json = merged_med

        if dent_data is not None:
            merged_dent = dict(patient.dental_history_json or {})
            for dk, dv in dent_data.items():
                if dv is not None:
                    merged_dent[dk] = dv
            patient.dental_history_json = merged_dent

        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="UPDATE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"updated_fields": list(update_dict.keys())},
            request=request,
        )

        return patient

    @staticmethod
    def update_severity(
        db: Session,
        patient_id: int,
        pain_scale: int,
        severity_level: str,
        current_user: User,
        request: Request | None = None,
    ) -> Patient:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        patient.pain_scale = pain_scale
        patient.severity_level = severity_level
        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="PATIENT_SEVERITY_UPDATE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"pain_scale": pain_scale, "severity_level": severity_level},
            request=request,
        )
        return patient

    @staticmethod
    def soft_delete_patient(
        db: Session,
        patient_id: int,
        current_user: User,
        request: Request | None = None,
    ) -> None:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        patient.is_deleted = True
        db.commit()

        log_audit_event(
            db=db,
            action="DELETE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details="Patient soft-deleted",
            request=request,
        )

    @staticmethod
    def get_patient_timeline(db: Session, patient_id: int, current_user: User | None = None) -> list[dict[str, Any]]:
        """Consolidate chronological clinical events across appointments and clinical_records (zero billing)."""
        patient = PatientService.get_patient_by_id(db, patient_id, current_user=current_user)
        events: list[dict[str, Any]] = []

        for appt in patient.appointments:
            events.append({
                "type": "appointment",
                "id": appt.id,
                "date": appt.appointment_date.isoformat(),
                "title": f"Appointment: {appt.appointment_type}",
                "status": appt.status,
                "operatory": appt.operatory,
                "notes": appt.notes or appt.reason,
                "doctor": appt.doctor.full_name if appt.doctor else None,
            })

        for rec in patient.clinical_records:
            payload = rec.payload_json or {}
            doc_name = rec.doctor.full_name if rec.doctor else None
            if rec.record_type == "visit":
                events.append({
                    "type": "visit",
                    "id": rec.id,
                    "date": rec.record_date.isoformat(),
                    "title": rec.title or "Clinical Visit / Examination",
                    "diagnosis": payload.get("diagnosis"),
                    "notes": payload.get("clinical_notes"),
                    "oral_findings": payload.get("oral_findings"),
                    "doctor": doc_name,
                })
            elif rec.record_type == "prescription":
                events.append({
                    "type": "prescription",
                    "id": rec.id,
                    "date": rec.record_date.isoformat(),
                    "title": f"Prescription #{payload.get('prescription_number', rec.id)}",
                    "item_count": len(payload.get("medications", [])),
                    "doctor": doc_name,
                })
            elif rec.record_type == "treatment_plan":
                events.append({
                    "type": "treatment_plan",
                    "id": rec.id,
                    "date": rec.record_date.isoformat(),
                    "title": f"Treatment Plan: {rec.title}",
                    "status": rec.status,
                    "doctor": doc_name,
                })
            elif rec.record_type == "surgical_log":
                events.append({
                    "type": "surgical_log",
                    "id": rec.id,
                    "date": rec.record_date.isoformat(),
                    "title": f"Surgical Log: {rec.title}",
                    "status": rec.status,
                    "doctor": doc_name,
                })

        events.sort(key=lambda x: x["date"], reverse=True)
        return events
