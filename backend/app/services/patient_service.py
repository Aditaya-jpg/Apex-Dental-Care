from datetime import UTC, date, datetime
from typing import Any
import uuid

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.patient import (
    DentalHistoryResponse,
    MedicalHistoryResponse,
    MiscRecordsUpdate,
    PatientCreate,
    PatientDetailResponse,
    PatientUpdate,
    SharedNoticeCreate,
    SurgicalLogCreate,
    SurgicalLogResponse,
    SurgicalLogUpdate,
    _split_full_name,
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


def to_surgical_log_response(rec: ClinicalRecord) -> SurgicalLogResponse:
    p = rec.payload_json or {}
    return SurgicalLogResponse(
        id=rec.id,
        patient_id=rec.patient_id or 0,
        doctor_id=rec.doctor_id,
        student_id=rec.student_id,
        record_date=rec.record_date,
        surgery_date=rec.record_date,
        title=rec.title or p.get("procedure_name", ""),
        status=rec.status,
        procedure_name=p.get("procedure_name") or rec.title or "",
        tooth_numbers=list(p.get("tooth_numbers") or []),
        surgeon_name=p.get("surgeon_name") or (rec.doctor.full_name if rec.doctor else None),
        anesthesia_type=p.get("anesthesia_type"),
        operative_notes=p.get("operative_notes"),
        post_op_instructions=p.get("post_op_instructions"),
        suture_removal_date=p.get("suture_removal_date"),
        linked_document_ids=list(p.get("linked_document_ids") or []),
        is_visible_to_patient=rec.is_visible_to_patient,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


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

        first_name = (data.first_name or "").strip()
        last_name = (data.last_name or "").strip()
        full_name = (data.full_name or f"{first_name} {last_name}").strip()

        new_patient = Patient(
            patient_code=patient_code,
            cr_number=cr_num,
            full_name=full_name,
            first_name=first_name,
            last_name=last_name,
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
                if not any(
                    c == p_cat or (len(c) >= 4 and c in p_cat)
                    for c in cat_list
                    for p_cat in p_cats
                ):
                    continue
            if kw_lower:
                med = p.medical_history_json or {}
                dent = p.dental_history_json or {}
                haystack = " ".join([
                    *(str(k) for k in (p.case_keywords or [])),
                    *(str(c) for c in (p.disease_categories or [])),
                    *(str(v) for v in med.values() if v),
                    *(str(v) for v in dent.values() if v),
                    p.full_name,
                    p.cr_number or "",
                    p.patient_code or "",
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

        if "full_name" in update_dict and update_dict["full_name"] and "first_name" not in update_dict:
            fn, ln = _split_full_name(update_dict["full_name"])
            update_dict["first_name"] = fn
            if "last_name" not in update_dict:
                update_dict["last_name"] = ln

        for k, v in update_dict.items():
            if hasattr(patient, k):
                setattr(patient, k, v)

        if "first_name" in update_dict or "last_name" in update_dict or "full_name" in update_dict:
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

    # ── Surgical Logs (ClinicalRecord record_type="surgical_log", is_visible_to_patient=False) ──

    @staticmethod
    def list_surgical_logs(db: Session, patient_id: int, current_user: User) -> list[SurgicalLogResponse]:
        verify_patient_access(db, current_user, patient_id)
        rows = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.patient_id == patient_id, ClinicalRecord.record_type == "surgical_log")
            .order_by(desc(ClinicalRecord.record_date), desc(ClinicalRecord.id))
            .all()
        )
        return [to_surgical_log_response(r) for r in rows]

    @staticmethod
    def create_surgical_log(
        db: Session,
        patient_id: int,
        data: SurgicalLogCreate,
        current_user: User,
        request: Request | None = None,
    ) -> SurgicalLogResponse:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        doc = resolve_doctor_for_user(db, current_user)
        target_doc_id = data.doctor_id or (doc.id if doc else patient.doctor_id)
        surgeon_name = data.surgeon_name or (doc.full_name if doc else current_user.full_name)
        surg_date = data.surgery_date or data.record_date or date.today()

        payload_json = {
            "procedure_name": data.procedure_name,
            "tooth_numbers": data.tooth_numbers,
            "surgeon_name": surgeon_name,
            "anesthesia_type": data.anesthesia_type,
            "operative_notes": data.operative_notes,
            "post_op_instructions": data.post_op_instructions,
            "suture_removal_date": data.suture_removal_date.isoformat() if data.suture_removal_date else None,
            "linked_document_ids": data.linked_document_ids,
        }

        rec = ClinicalRecord(
            patient_id=patient.id,
            doctor_id=target_doc_id,
            student_id=patient.student_id,
            record_type="surgical_log",
            record_date=surg_date,
            title=data.title or data.procedure_name,
            status=data.status or "completed",
            language=patient.preferred_language or "en",
            is_visible_to_patient=False,
            payload_json=payload_json,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

        log_audit_event(
            db=db,
            action="SURGICAL_LOG_CREATE",
            user=current_user,
            entity_name="SurgicalLog",
            entity_id=str(rec.id),
            patient_id=patient.id,
            details={"procedure_name": data.procedure_name, "tooth_numbers": data.tooth_numbers},
            request=request,
        )

        # Trigger localized post-treatment instruction alert via NotificationService
        from app.services.notification_service import NotificationService

        NotificationService.send_post_treatment_instruction(
            db,
            patient=patient,
            procedure_name=data.procedure_name,
            custom_instructions=data.post_op_instructions,
            actor_user=current_user,
        )

        return to_surgical_log_response(rec)

    @staticmethod
    def update_surgical_log(
        db: Session,
        patient_id: int,
        log_id: int,
        data: SurgicalLogUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> SurgicalLogResponse:
        verify_patient_access(db, current_user, patient_id, require_write=True)
        rec = (
            db.query(ClinicalRecord)
            .filter(
                ClinicalRecord.id == log_id,
                ClinicalRecord.patient_id == patient_id,
                ClinicalRecord.record_type == "surgical_log",
            )
            .first()
        )
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SURGICAL_LOG_NOT_FOUND", "message": "Surgical log not found."},
            )

        update_dict = data.model_dump(exclude_unset=True)
        payload = dict(rec.payload_json or {})
        new_date = update_dict.pop("surgery_date", None) or update_dict.pop("record_date", None)
        if new_date:
            rec.record_date = new_date
        if "title" in update_dict and update_dict["title"]:
            rec.title = update_dict.pop("title")
        if "status" in update_dict and update_dict["status"]:
            rec.status = update_dict.pop("status")
        if "suture_removal_date" in update_dict:
            srd = update_dict.pop("suture_removal_date")
            payload["suture_removal_date"] = srd.isoformat() if srd else None

        for k, v in update_dict.items():
            payload[k] = v
        if update_dict.get("procedure_name") and not data.title:
            rec.title = update_dict["procedure_name"]
        rec.payload_json = payload

        db.commit()
        db.refresh(rec)

        log_audit_event(
            db=db,
            action="SURGICAL_LOG_UPDATE",
            user=current_user,
            entity_name="SurgicalLog",
            entity_id=str(rec.id),
            patient_id=patient_id,
            details={"procedure_name": payload.get("procedure_name")},
            request=request,
        )
        return to_surgical_log_response(rec)

    @staticmethod
    def delete_surgical_log(
        db: Session,
        patient_id: int,
        log_id: int,
        current_user: User,
        request: Request | None = None,
    ) -> None:
        verify_patient_access(db, current_user, patient_id, require_write=True)
        rec = (
            db.query(ClinicalRecord)
            .filter(
                ClinicalRecord.id == log_id,
                ClinicalRecord.patient_id == patient_id,
                ClinicalRecord.record_type == "surgical_log",
            )
            .first()
        )
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SURGICAL_LOG_NOT_FOUND", "message": "Surgical log not found."},
            )
        db.delete(rec)
        db.commit()
        log_audit_event(
            db=db,
            action="SURGICAL_LOG_DELETE",
            user=current_user,
            entity_name="SurgicalLog",
            entity_id=str(log_id),
            patient_id=patient_id,
            details={"deleted_id": log_id},
            request=request,
        )

    # ── Category-Specific Miscellaneous Records (patient.misc_records_json) ──

    @staticmethod
    def get_misc_records(db: Session, patient_id: int, current_user: User) -> dict[str, Any]:
        patient = verify_patient_access(db, current_user, patient_id)
        return {
            "patient_id": patient.id,
            "disease_categories": list(patient.disease_categories or []),
            "records": dict(patient.misc_records_json or {}),
        }

    @staticmethod
    def update_misc_records(
        db: Session,
        patient_id: int,
        data: MiscRecordsUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> dict[str, Any]:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        current_misc = dict(patient.misc_records_json or {})
        incoming_records = data.records if data.records is not None else data.misc_records_json
        if incoming_records is not None:
            current_misc = dict(incoming_records)
        if data.category is not None:
            current_misc[data.category] = data.notes
        patient.misc_records_json = current_misc
        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="MISC_RECORDS_UPDATE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"categories": list(current_misc.keys())},
            request=request,
        )
        return {
            "patient_id": patient.id,
            "disease_categories": list(patient.disease_categories or []),
            "records": dict(patient.misc_records_json or {}),
        }

    # ── Doctor-to-Patient Advisories / Shared Notices (patient.patient_shared_notices_json) ──

    @staticmethod
    def get_shared_notices(db: Session, patient_id: int, current_user: User) -> list[dict[str, Any]]:
        patient = verify_patient_access(db, current_user, patient_id, allow_patient_self=True)
        normalized = []
        for n in list(patient.patient_shared_notices_json or []):
            item = dict(n)
            item.setdefault("category", item.get("notice_type") or "scan_request")
            if not item.get("notice_type"):
                item["notice_type"] = item["category"]
            normalized.append(item)
        return normalized

    @staticmethod
    def add_shared_notice(
        db: Session,
        patient_id: int,
        data: SharedNoticeCreate,
        current_user: User,
        request: Request | None = None,
    ) -> dict[str, Any]:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        notices = list(patient.patient_shared_notices_json or [])
        notice = {
            "id": f"notice-{uuid.uuid4().hex[:8]}",
            "category": data.category or "scan_request",
            "notice_type": data.notice_type or data.category or "scan_request",
            "title": data.title.strip(),
            "message": (data.message or data.title).strip(),
            "description": data.description,
            "due_date": data.due_date or data.target_date,
            "target_date": data.target_date or data.due_date,
            "language": data.language,
            "created_by": current_user.full_name,
            "created_at": datetime.now(UTC).isoformat(),
        }
        notices.insert(0, notice)
        patient.patient_shared_notices_json = notices
        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="SHARED_NOTICE_ADD",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"notice_id": notice["id"], "category": notice["category"], "title": notice["title"]},
            request=request,
        )
        return notice

    @staticmethod
    def delete_shared_notice(
        db: Session,
        patient_id: int,
        notice_id: str,
        current_user: User,
        request: Request | None = None,
    ) -> None:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        notices = list(patient.patient_shared_notices_json or [])
        filtered = [n for n in notices if str(n.get("id")) != str(notice_id)]
        if len(filtered) == len(notices):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOTICE_NOT_FOUND", "message": f"Shared notice '{notice_id}' not found."},
            )
        patient.patient_shared_notices_json = filtered
        db.commit()
        log_audit_event(
            db=db,
            action="SHARED_NOTICE_DELETE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"notice_id": notice_id},
            request=request,
        )
