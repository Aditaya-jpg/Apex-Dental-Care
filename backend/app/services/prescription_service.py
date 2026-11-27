from datetime import UTC, date, datetime
from typing import Any
import uuid

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.i18n.translations import (
    get_prescription_labels,
    localize_medication_item,
    lookup_instruction,
    normalize_language,
    translate_clinical_text,
)
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.pdf.generator import generate_prescription_pdf
from app.schemas.prescription import (
    InstructionSendRequest,
    PrescriptionCreate,
    PrescriptionItemResponse,
    PrescriptionResponse,
    RxTemplateCreate,
)
from app.security.dependencies import (
    resolve_doctor_for_user,
    resolve_student_for_user,
    verify_patient_access,
)


def to_prescription_response(rec: ClinicalRecord) -> PrescriptionResponse:
    p = rec.payload_json or {}
    doc_name = rec.doctor.full_name if rec.doctor else None
    items = [
        PrescriptionItemResponse(
            id=idx,
            prescription_id=rec.id,
            medicine_name=m.get("medicine_name", ""),
            dosage=m.get("dosage", ""),
            frequency=m.get("frequency", ""),
            duration=m.get("duration", ""),
            timing=m.get("timing", "After Food"),
            instructions=m.get("instructions"),
            localized_instructions=m.get("localized_instructions"),
        )
        for idx, m in enumerate(p.get("medications", []), start=1)
    ]
    return PrescriptionResponse(
        id=rec.id,
        prescription_number=p.get("prescription_number") or f"RX-{rec.id}",
        patient_id=rec.patient_id or 0,
        doctor_id=rec.doctor_id,
        dentist_id=rec.doctor_id,
        visit_id=rec.appointment_id,
        diagnosis_summary=p.get("diagnosis_summary"),
        general_instructions=p.get("general_instructions"),
        treatment_instructions=p.get("treatment_instructions"),
        localized_summary=p.get("localized_summary"),
        template_name=p.get("template_name"),
        language=rec.language or "en",
        is_visible_to_patient=rec.is_visible_to_patient,
        created_at=rec.created_at,
        doctor_name=doc_name,
        dentist_name=doc_name,
        patient_name=rec.patient.full_name if rec.patient else None,
        items=items,
    )


class PrescriptionService:
    @staticmethod
    def _generate_rx_number(db: Session) -> str:
        count = (
            db.query(func.count(ClinicalRecord.id))
            .filter(ClinicalRecord.record_type == "prescription")
            .scalar()
            or 0
        )
        return f"RX-2026-{1001 + count}"

    @classmethod
    def create_prescription(
        cls,
        db: Session,
        data: PrescriptionCreate,
        current_user: User,
        request: Request | None = None,
    ) -> ClinicalRecord:
        patient = verify_patient_access(db, current_user, data.patient_id, require_write=True)

        target_doc_id = data.doctor_id
        if target_doc_id is None:
            doc = resolve_doctor_for_user(db, current_user)
            target_doc_id = doc.id if doc else patient.doctor_id

        if target_doc_id is not None:
            doctor = db.query(Doctor).filter(Doctor.id == target_doc_id).first()
            if not doctor:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCTOR_NOT_FOUND", "message": "Doctor not found."},
                )

        lang = normalize_language(data.language or patient.preferred_language)
        rx_number = cls._generate_rx_number(db)

        meds_payload: list[dict[str, Any]] = []
        for item in data.items:
            m_dict = item.model_dump()
            if not m_dict.get("localized_instructions"):
                m_dict["localized_instructions"] = localize_medication_item(m_dict, lang)
            meds_payload.append(m_dict)

        labels = get_prescription_labels(lang)
        raw_summary = data.treatment_instructions or data.general_instructions
        localized_summary = (
            translate_clinical_text(raw_summary, lang)
            if raw_summary
            else f"{labels['prescription_title']} ({len(meds_payload)} items)"
        )

        payload_json = {
            "prescription_number": rx_number,
            "template_name": data.template_name,
            "diagnosis_summary": data.diagnosis_summary,
            "general_instructions": data.general_instructions,
            "treatment_instructions": data.treatment_instructions,
            "localized_summary": localized_summary,
            "medications": meds_payload,
        }

        rx = ClinicalRecord(
            patient_id=patient.id,
            doctor_id=target_doc_id,
            student_id=patient.student_id,
            appointment_id=data.visit_id,
            record_type="prescription",
            record_date=date.today(),
            title=data.template_name or data.diagnosis_summary or f"Prescription {rx_number}",
            status="issued",
            language=lang,
            is_visible_to_patient=data.is_visible_to_patient,
            payload_json=payload_json,
        )
        db.add(rx)
        db.commit()
        db.refresh(rx)

        log_audit_event(
            db=db,
            action="PRESCRIPTION_CREATE",
            user=current_user,
            entity_name="Prescription",
            entity_id=str(rx.id),
            patient_id=patient.id,
            details={"rx_number": rx_number, "language": lang, "items_count": len(data.items)},
            request=request,
        )

        return rx

    @staticmethod
    def get_prescriptions(
        db: Session,
        current_user: User,
        patient_id: int | None = None,
        doctor_id: int | None = None,
    ) -> list[ClinicalRecord]:
        query = db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "prescription")

        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return []
            assigned_ids = [
                r[0]
                for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
            ]
            if not assigned_ids:
                return []
            query = query.filter(ClinicalRecord.patient_id.in_(assigned_ids))

        if patient_id is not None:
            verify_patient_access(db, current_user, patient_id)
            query = query.filter(ClinicalRecord.patient_id == patient_id)
        if doctor_id is not None:
            query = query.filter(ClinicalRecord.doctor_id == doctor_id)

        return query.order_by(desc(ClinicalRecord.created_at), desc(ClinicalRecord.id)).all()

    @staticmethod
    def get_prescription_by_id(
        db: Session,
        prescription_id: int,
        current_user: User,
        *,
        allow_patient_self: bool = False,
    ) -> ClinicalRecord:
        rx = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.id == prescription_id, ClinicalRecord.record_type == "prescription")
            .first()
        )
        if not rx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PRESCRIPTION_NOT_FOUND", "message": "Prescription not found."},
            )
        verify_patient_access(db, current_user, rx.patient_id, allow_patient_self=allow_patient_self)
        if current_user.role == "patient" and not rx.is_visible_to_patient:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Prescription is not marked visible to patient."},
            )
        return rx

    @staticmethod
    def get_templates(db: Session) -> list[dict]:
        templates = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.record_type == "rx_template")
            .order_by(ClinicalRecord.id.asc())
            .all()
        )
        return [
            {
                "id": t.id,
                "title": t.title,
                "language": t.language,
                **(t.payload_json or {}),
            }
            for t in templates
        ]

    @staticmethod
    def create_template(
        db: Session,
        data: RxTemplateCreate,
        current_user: User,
        request: Request | None = None,
    ) -> dict[str, Any]:
        doc = resolve_doctor_for_user(db, current_user)
        lang = normalize_language(data.language)
        tpl = ClinicalRecord(
            patient_id=None,
            doctor_id=doc.id if doc else None,
            record_type="rx_template",
            record_date=date.today(),
            title=data.template_name.strip(),
            status="active",
            language=lang,
            is_visible_to_patient=False,
            payload_json={
                "template_name": data.template_name.strip(),
                "diagnosis_summary": data.diagnosis_summary,
                "general_instructions": data.general_instructions,
                "medications": [m.model_dump() for m in data.medications],
            },
        )
        db.add(tpl)
        db.commit()
        db.refresh(tpl)

        log_audit_event(
            db=db,
            action="RX_TEMPLATE_CREATE",
            user=current_user,
            entity_name="RxTemplate",
            entity_id=str(tpl.id),
            details={"template_name": tpl.title, "items": len(data.medications)},
            request=request,
        )
        return {
            "id": tpl.id,
            "title": tpl.title,
            "language": tpl.language,
            **(tpl.payload_json or {}),
        }

    @staticmethod
    def send_localized_instruction(
        db: Session,
        data: InstructionSendRequest,
        current_user: User,
        request: Request | None = None,
    ) -> dict[str, Any]:
        patient = verify_patient_access(db, current_user, data.patient_id, require_write=True)
        lang = normalize_language(data.language or patient.preferred_language)

        resolved_category = data.category
        resolved_title = data.title or "Treatment Care Instructions"
        resolved_text = ""

        if data.instruction_key:
            found = lookup_instruction(data.instruction_key, lang)
            if not found:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "INSTRUCTION_NOT_FOUND", "message": f"Instruction key '{data.instruction_key}' not found."},
                )
            resolved_category, looked_title, resolved_text = found
            if not data.title:
                resolved_title = looked_title

        if data.custom_text:
            resolved_text = (
                f"{resolved_text} {data.custom_text}".strip()
                if (resolved_text and data.custom_text.strip() != resolved_text.strip())
                else data.custom_text.strip()
            )

        if not resolved_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INSTRUCTION_TEXT_REQUIRED", "message": "Provide instruction_key or custom_text."},
            )

        notices = list(patient.patient_shared_notices_json or [])
        notice = {
            "id": f"instr-{uuid.uuid4().hex[:8]}",
            "category": resolved_category,
            "instruction_key": data.instruction_key,
            "title": resolved_title,
            "message": resolved_text,
            "language": lang,
            "created_by": current_user.full_name,
            "created_at": datetime.now(UTC).isoformat(),
        }
        notices.insert(0, notice)
        patient.patient_shared_notices_json = notices
        db.commit()
        db.refresh(patient)

        from app.services.notification_service import NotificationService

        notif = NotificationService.dispatch_notification(
            db,
            patient_id=patient.id,
            channel=data.channel,
            category=resolved_category,
            title=resolved_title,
            message_body=resolved_text,
            language=lang,
            actor_user=current_user,
            extra_payload={"instruction_key": data.instruction_key, "notice_id": notice["id"]},
        )

        log_audit_event(
            db=db,
            action="INSTRUCTION_SEND",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details={"instruction_key": data.instruction_key, "language": lang, "notification_id": notif.id},
            request=request,
        )

        return {
            "patient_id": patient.id,
            "notice": notice,
            "notification_id": notif.id,
            "status": notif.status,
            "language": lang,
        }

    @classmethod
    def get_pdf(cls, db: Session, prescription_id: int, current_user: User) -> bytes:
        rx = cls.get_prescription_by_id(db, prescription_id, current_user, allow_patient_self=True)
        return generate_prescription_pdf(rx, rx.patient, rx.doctor)
