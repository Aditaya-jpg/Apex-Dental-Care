from datetime import date

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.pdf.generator import generate_prescription_pdf
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionItemResponse,
    PrescriptionResponse,
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

        rx_number = cls._generate_rx_number(db)
        meds_payload = [item.model_dump() for item in data.items]
        payload_json = {
            "prescription_number": rx_number,
            "template_name": data.template_name,
            "diagnosis_summary": data.diagnosis_summary,
            "general_instructions": data.general_instructions,
            "treatment_instructions": data.treatment_instructions,
            "localized_summary": data.treatment_instructions or data.general_instructions,
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
            language=data.language or patient.preferred_language or "en",
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
            details={"rx_number": rx_number, "items_count": len(data.items)},
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

    @classmethod
    def get_pdf(cls, db: Session, prescription_id: int, current_user: User) -> bytes:
        rx = cls.get_prescription_by_id(db, prescription_id, current_user, allow_patient_self=True)
        return generate_prescription_pdf(rx, rx.patient, rx.doctor)
