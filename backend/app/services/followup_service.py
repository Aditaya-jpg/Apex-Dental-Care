from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.care_log import CareAndSystemLog
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.schemas.followup import FollowUpCreate, FollowUpResponse, FollowUpUpdate
from app.security.dependencies import (
    resolve_doctor_for_user,
    resolve_student_for_user,
    verify_patient_access,
)


def to_followup_response(log: CareAndSystemLog) -> FollowUpResponse:
    p = log.payload_json or {}
    doc_name = log.assigned_doctor.full_name if log.assigned_doctor else None
    return FollowUpResponse(
        id=log.id,
        patient_id=log.patient_id or 0,
        doctor_id=log.assigned_doctor_id,
        dentist_id=log.assigned_doctor_id,
        visit_id=p.get("visit_id"),
        scheduled_date=log.scheduled_date,
        reason=log.title or p.get("reason", ""),
        notes=p.get("notes"),
        status=log.status,
        created_at=log.created_at,
        updated_at=log.updated_at,
        patient_name=log.patient.full_name if log.patient else None,
        doctor_name=doc_name,
        dentist_name=doc_name,
    )


class FollowUpService:
    @staticmethod
    def create_followup(
        db: Session,
        data: FollowUpCreate,
        current_user: User,
        request: Request | None = None,
    ) -> CareAndSystemLog:
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

        followup = CareAndSystemLog(
            event_type="followup",
            patient_id=patient.id,
            actor_user_id=current_user.id,
            assigned_doctor_id=target_doc_id,
            assigned_student_id=patient.student_id,
            status="pending",
            scheduled_date=data.scheduled_date,
            channel="system",
            language=patient.preferred_language or "en",
            title=data.reason,
            payload_json={
                "visit_id": data.visit_id,
                "reason": data.reason,
                "notes": data.notes,
            },
        )
        db.add(followup)
        db.commit()
        db.refresh(followup)

        log_audit_event(
            db=db,
            action="CREATE",
            user=current_user,
            entity_name="FollowUp",
            entity_id=str(followup.id),
            patient_id=patient.id,
            details={"patient_id": patient.id, "scheduled_date": str(followup.scheduled_date)},
            request=request,
        )

        return followup

    @staticmethod
    def get_followups(
        db: Session,
        current_user: User,
        patient_id: int | None = None,
        doctor_id: int | None = None,
        status_filter: str | None = None,
    ) -> list[CareAndSystemLog]:
        query = db.query(CareAndSystemLog).filter(CareAndSystemLog.event_type == "followup")

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
            query = query.filter(CareAndSystemLog.patient_id.in_(assigned_ids))

        if patient_id is not None:
            verify_patient_access(db, current_user, patient_id)
            query = query.filter(CareAndSystemLog.patient_id == patient_id)
        if doctor_id is not None:
            query = query.filter(CareAndSystemLog.assigned_doctor_id == doctor_id)
        if status_filter:
            query = query.filter(CareAndSystemLog.status == status_filter)

        return query.order_by(CareAndSystemLog.scheduled_date.asc(), CareAndSystemLog.id.asc()).all()

    @staticmethod
    def update_followup(
        db: Session,
        followup_id: int,
        data: FollowUpUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> CareAndSystemLog:
        fu = (
            db.query(CareAndSystemLog)
            .filter(CareAndSystemLog.id == followup_id, CareAndSystemLog.event_type == "followup")
            .first()
        )
        if not fu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FOLLOWUP_NOT_FOUND", "message": "Follow-up record not found."},
            )

        if fu.patient_id is not None:
            verify_patient_access(db, current_user, fu.patient_id, require_write=True)

        update_dict = data.model_dump(exclude_unset=True)
        payload = dict(fu.payload_json or {})
        if "scheduled_date" in update_dict:
            fu.scheduled_date = update_dict["scheduled_date"]
        if "status" in update_dict:
            fu.status = update_dict["status"]
        if "reason" in update_dict:
            fu.title = update_dict["reason"]
            payload["reason"] = update_dict["reason"]
        if "notes" in update_dict:
            payload["notes"] = update_dict["notes"]
        fu.payload_json = payload

        db.commit()
        db.refresh(fu)

        log_audit_event(
            db=db,
            action="UPDATE",
            user=current_user,
            entity_name="FollowUp",
            entity_id=str(fu.id),
            patient_id=fu.patient_id,
            details={"status": fu.status},
            request=request,
        )

        return fu
