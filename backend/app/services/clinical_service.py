from fastapi import HTTPException, Request, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.appointment import Appointment
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.clinical import VisitCreate, VisitResponse, VisitUpdate
from app.security.dependencies import resolve_doctor_for_user, verify_patient_access


def to_visit_response(rec: ClinicalRecord) -> VisitResponse:
    p = rec.payload_json or {}
    doc_name = rec.doctor.full_name if rec.doctor else None
    return VisitResponse(
        id=rec.id,
        patient_id=rec.patient_id,
        doctor_id=rec.doctor_id,
        dentist_id=rec.doctor_id,
        appointment_id=rec.appointment_id,
        visit_date=rec.record_date,
        vitals_blood_pressure=p.get("vitals_blood_pressure"),
        vitals_pulse=p.get("vitals_pulse"),
        chief_complaint=p.get("chief_complaint"),
        general_exam_notes=p.get("general_exam_notes"),
        extraoral_findings=p.get("extraoral_findings"),
        tmj_status=p.get("tmj_status"),
        lymph_nodes=p.get("lymph_nodes"),
        intraoral_hard_tissue=p.get("intraoral_hard_tissue"),
        intraoral_soft_tissue=p.get("intraoral_soft_tissue"),
        occlusion_status=p.get("occlusion_status"),
        oral_findings=p.get("oral_findings"),
        gum_condition=p.get("gum_condition"),
        hygiene_index=p.get("hygiene_index"),
        diagnosis=p.get("diagnosis"),
        clinical_notes=p.get("clinical_notes"),
        pain_scale=p.get("pain_scale"),
        severity_level=p.get("severity_level"),
        created_at=rec.created_at,
        doctor_name=doc_name,
        dentist_name=doc_name,
        patient_name=rec.patient.full_name if rec.patient else None,
    )


class ClinicalService:
    @staticmethod
    def create_visit(
        db: Session,
        data: VisitCreate,
        current_user: User,
        request: Request | None = None,
    ) -> ClinicalRecord:
        """Record a dental visit and examination in clinical_records (is_visible_to_patient=False)."""
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
                    detail={"code": "DOCTOR_NOT_FOUND", "message": "Doctor does not exist."},
                )

        if data.appointment_id:
            appt = db.query(Appointment).filter(Appointment.id == data.appointment_id).first()
            if appt:
                appt.status = "completed"
                appt.attendance_status = "completed"

        payload = {
            "vitals_blood_pressure": data.vitals_blood_pressure,
            "vitals_pulse": data.vitals_pulse,
            "chief_complaint": data.chief_complaint,
            "general_exam_notes": data.general_exam_notes,
            "extraoral_findings": data.extraoral_findings,
            "tmj_status": data.tmj_status,
            "lymph_nodes": data.lymph_nodes,
            "intraoral_hard_tissue": data.intraoral_hard_tissue,
            "intraoral_soft_tissue": data.intraoral_soft_tissue,
            "occlusion_status": data.occlusion_status,
            "oral_findings": data.oral_findings,
            "gum_condition": data.gum_condition,
            "hygiene_index": data.hygiene_index,
            "diagnosis": data.diagnosis,
            "clinical_notes": data.clinical_notes,
            "pain_scale": data.pain_scale,
            "severity_level": data.severity_level,
        }

        visit = ClinicalRecord(
            patient_id=patient.id,
            doctor_id=target_doc_id,
            student_id=patient.student_id,
            appointment_id=data.appointment_id,
            record_type="visit",
            record_date=data.visit_date,
            title=data.chief_complaint or data.diagnosis or "Clinical Examination",
            status="completed",
            language=patient.preferred_language or "en",
            is_visible_to_patient=False,
            payload_json=payload,
        )
        db.add(visit)

        # Sync latest pain_scale & severity_level onto Patient
        if data.pain_scale is not None:
            patient.pain_scale = data.pain_scale
        if data.severity_level is not None:
            patient.severity_level = data.severity_level

        db.commit()
        db.refresh(visit)

        log_audit_event(
            db=db,
            action="CREATE",
            user=current_user,
            entity_name="Visit",
            entity_id=str(visit.id),
            patient_id=patient.id,
            details={"patient_id": patient.id, "diagnosis": data.diagnosis},
            request=request,
        )

        return visit

    @staticmethod
    def get_visit_by_id(db: Session, visit_id: int, current_user: User) -> ClinicalRecord:
        visit = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.id == visit_id, ClinicalRecord.record_type == "visit")
            .first()
        )
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "VISIT_NOT_FOUND", "message": f"Visit with ID {visit_id} was not found."},
            )
        verify_patient_access(db, current_user, visit.patient_id)
        return visit

    @staticmethod
    def get_patient_visits(db: Session, patient_id: int, current_user: User) -> list[ClinicalRecord]:
        verify_patient_access(db, current_user, patient_id)
        return (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.patient_id == patient_id, ClinicalRecord.record_type == "visit")
            .order_by(desc(ClinicalRecord.record_date), desc(ClinicalRecord.id))
            .all()
        )

    @staticmethod
    def update_visit(
        db: Session,
        visit_id: int,
        data: VisitUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> ClinicalRecord:
        visit = ClinicalService.get_visit_by_id(db, visit_id, current_user)
        verify_patient_access(db, current_user, visit.patient_id, require_write=True)

        update_dict = data.model_dump(exclude_unset=True)
        merged_payload = dict(visit.payload_json or {})
        merged_payload.update(update_dict)
        visit.payload_json = merged_payload

        if update_dict.get("diagnosis"):
            visit.title = update_dict["diagnosis"]
        if visit.patient:
            if data.pain_scale is not None:
                visit.patient.pain_scale = data.pain_scale
            if data.severity_level is not None:
                visit.patient.severity_level = data.severity_level

        db.commit()
        db.refresh(visit)

        log_audit_event(
            db=db,
            action="UPDATE",
            user=current_user,
            entity_name="Visit",
            entity_id=str(visit.id),
            patient_id=visit.patient_id,
            details={"updated_fields": list(update_dict.keys())},
            request=request,
        )

        return visit
