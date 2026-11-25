from datetime import UTC, date, datetime

from fastapi import HTTPException, Request, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.schemas.treatment import (
    TreatmentItemCreate,
    TreatmentItemResponse,
    TreatmentItemUpdate,
    TreatmentPlanCreate,
    TreatmentPlanResponse,
)
from app.security.dependencies import (
    resolve_doctor_for_user,
    resolve_student_for_user,
    verify_patient_access,
)


def _next_item_id(db: Session, items: list[dict]) -> int:
    """Generate a unique integer item id across treatment plans."""
    existing_max = 0
    for plan in db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "treatment_plan").all():
        for it in (plan.payload_json or {}).get("items", []):
            try:
                existing_max = max(existing_max, int(it.get("id", 0)))
            except Exception:
                pass
    for it in items:
        try:
            existing_max = max(existing_max, int(it.get("id", 0)))
        except Exception:
            pass
    return existing_max + 1


def _to_item_response(plan_id: int, item: dict) -> TreatmentItemResponse:
    return TreatmentItemResponse(
        id=item["id"],
        treatment_plan_id=plan_id,
        procedure_name=item["procedure_name"],
        tooth_number=item.get("tooth_number"),
        status=item.get("status", "planned"),
        visit_id=item.get("visit_id"),
        notes=item.get("notes"),
        completed_at=datetime.fromisoformat(item["completed_at"]) if item.get("completed_at") else None,
        created_at=datetime.fromisoformat(item["created_at"]) if item.get("created_at") else None,
    )


def to_treatment_plan_response(rec: ClinicalRecord) -> TreatmentPlanResponse:
    p = rec.payload_json or {}
    doc_name = rec.doctor.full_name if rec.doctor else None
    items = [_to_item_response(rec.id, it) for it in p.get("items", [])]
    return TreatmentPlanResponse(
        id=rec.id,
        patient_id=rec.patient_id,
        doctor_id=rec.doctor_id,
        dentist_id=rec.doctor_id,
        title=rec.title,
        status=rec.status,
        notes=p.get("notes"),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        doctor_name=doc_name,
        dentist_name=doc_name,
        patient_name=rec.patient.full_name if rec.patient else None,
        treatments=items,
    )


class TreatmentService:
    @classmethod
    def create_treatment_plan(
        cls,
        db: Session,
        data: TreatmentPlanCreate,
        current_user: User,
        request: Request | None = None,
    ) -> ClinicalRecord:
        """Create a clinical treatment plan in clinical_records (zero costs/billing, is_visible_to_patient=False)."""
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

        now_iso = datetime.now(UTC).isoformat()
        next_id = _next_item_id(db, [])
        items_payload = []
        for idx, item_data in enumerate(data.treatments):
            items_payload.append({
                "id": next_id + idx,
                "procedure_name": item_data.procedure_name,
                "tooth_number": item_data.tooth_number,
                "status": "planned",
                "visit_id": None,
                "notes": item_data.notes,
                "completed_at": None,
                "created_at": now_iso,
            })

        plan = ClinicalRecord(
            patient_id=patient.id,
            doctor_id=target_doc_id,
            student_id=patient.student_id,
            record_type="treatment_plan",
            record_date=date.today(),
            title=data.title,
            status="active",
            language=patient.preferred_language or "en",
            is_visible_to_patient=False,
            payload_json={"notes": data.notes, "items": items_payload},
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        log_audit_event(
            db=db,
            action="CREATE",
            user=current_user,
            entity_name="TreatmentPlan",
            entity_id=str(plan.id),
            patient_id=patient.id,
            details={"patient_id": plan.patient_id, "title": plan.title, "items_count": len(items_payload)},
            request=request,
        )

        return plan

    @staticmethod
    def get_plans(
        db: Session,
        current_user: User,
        patient_id: int | None = None,
        doctor_id: int | None = None,
        status_filter: str | None = None,
    ) -> list[ClinicalRecord]:
        query = db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "treatment_plan")

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
        if status_filter:
            query = query.filter(ClinicalRecord.status == status_filter)

        return query.order_by(desc(ClinicalRecord.created_at), desc(ClinicalRecord.id)).all()

    @staticmethod
    def get_plan_by_id(db: Session, plan_id: int, current_user: User) -> ClinicalRecord:
        plan = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.id == plan_id, ClinicalRecord.record_type == "treatment_plan")
            .first()
        )
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PLAN_NOT_FOUND", "message": f"Treatment plan {plan_id} not found."},
            )
        verify_patient_access(db, current_user, plan.patient_id)
        return plan

    @classmethod
    def add_treatment_item(
        cls,
        db: Session,
        plan_id: int,
        data: TreatmentItemCreate,
        current_user: User,
        request: Request | None = None,
    ) -> TreatmentItemResponse:
        plan = cls.get_plan_by_id(db, plan_id, current_user)
        verify_patient_access(db, current_user, plan.patient_id, require_write=True)

        payload = dict(plan.payload_json or {})
        items = list(payload.get("items") or [])
        now_iso = datetime.now(UTC).isoformat()
        new_item = {
            "id": _next_item_id(db, items),
            "procedure_name": data.procedure_name,
            "tooth_number": data.tooth_number,
            "status": "planned",
            "visit_id": None,
            "notes": data.notes,
            "completed_at": None,
            "created_at": now_iso,
        }
        items.append(new_item)
        payload["items"] = items
        plan.payload_json = payload

        db.commit()
        db.refresh(plan)

        log_audit_event(
            db=db,
            action="TREATMENT_ADD",
            user=current_user,
            entity_name="TreatmentItem",
            entity_id=str(new_item["id"]),
            patient_id=plan.patient_id,
            details={"plan_id": plan.id, "procedure": new_item["procedure_name"]},
            request=request,
        )

        return _to_item_response(plan.id, new_item)

    @classmethod
    def update_treatment_item(
        cls,
        db: Session,
        item_id: int,
        data: TreatmentItemUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> TreatmentItemResponse:
        plans = db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "treatment_plan").all()
        target_plan: ClinicalRecord | None = None
        target_idx: int = -1

        for plan in plans:
            items = (plan.payload_json or {}).get("items", [])
            for idx, it in enumerate(items):
                if str(it.get("id")) == str(item_id):
                    target_plan = plan
                    target_idx = idx
                    break
            if target_plan:
                break

        if not target_plan or target_idx < 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "ITEM_NOT_FOUND", "message": "Treatment item not found."},
            )

        verify_patient_access(db, current_user, target_plan.patient_id, require_write=True)

        payload = dict(target_plan.payload_json or {})
        items = [dict(it) for it in payload.get("items", [])]
        item = items[target_idx]

        update_dict = data.model_dump(exclude_unset=True)
        if update_dict.get("status") == "completed" and item.get("status") != "completed":
            item["completed_at"] = datetime.now(UTC).isoformat()

        for k, v in update_dict.items():
            item[k] = v

        items[target_idx] = item
        payload["items"] = items
        target_plan.payload_json = payload

        db.commit()
        db.refresh(target_plan)

        log_audit_event(
            db=db,
            action="TREATMENT_UPDATE",
            user=current_user,
            entity_name="TreatmentItem",
            entity_id=str(item_id),
            patient_id=target_plan.patient_id,
            details={"status": item.get("status"), "procedure": item.get("procedure_name")},
            request=request,
        )

        return _to_item_response(target_plan.id, item)
