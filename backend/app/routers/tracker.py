"""Patient Tracker Router: Telephonic/Social Enquiries, Stage Funnel, Slipping Detection & Conversion."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.appointment import Appointment
from app.models.care_log import CareAndSystemLog
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientCreate
from app.security.dependencies import require_roles, resolve_doctor_for_user, resolve_student_for_user
from app.services.patient_service import PatientService, to_patient_detail

router = APIRouter(prefix="/tracker", tags=["Patient Tracker & Enquiries"])

TRACKER_STAGES = (
    "enquiry",
    "registered",
    "diagnosed",
    "in_treatment",
    "followup",
    "slipping",
    "completed",
)


class EnquiryCreate(BaseModel):
    caller_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=50)
    email: str | None = None
    source_channel: str = "phone_enquiry"
    chief_complaint: str | None = None
    preferred_language: str = Field(default="en", pattern="^(en|hi|pa)$")
    follow_up_date: date | None = None
    followup_date: date | None = None
    scheduled_date: date | None = None
    notes: str | None = None
    assigned_doctor_id: int | None = None
    assigned_student_id: int | None = None
    title: str | None = None


class EnquiryUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(open|contacted|converted|closed)$")
    stage: str | None = None
    follow_up_date: date | None = None
    followup_date: date | None = None
    scheduled_date: date | None = None
    notes: str | None = None
    chief_complaint: str | None = None
    assigned_doctor_id: int | None = None
    assigned_student_id: int | None = None
    tracker_stage: str | None = None


class EnquiryConvertRequest(BaseModel):
    full_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, pattern="^(Male|Female|Other)$")
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    preferred_language: str | None = Field(default=None, pattern="^(en|hi|pa)$")
    doctor_id: int | None = None
    student_id: int | None = None
    cr_number: str | None = None
    disease_categories: list[str] = []


def _serialize_enquiry(log: CareAndSystemLog) -> dict[str, Any]:
    p = log.payload_json or {}
    sched = log.scheduled_date.isoformat() if log.scheduled_date else None
    stage_val = p.get("stage") or (
        "registered" if log.status == "converted" else "enquiry"
    )
    return {
        "id": log.id,
        "event_type": log.event_type,
        "patient_id": log.patient_id,
        "converted_patient_id": log.patient_id,
        "assigned_doctor_id": log.assigned_doctor_id,
        "assigned_doctor_name": log.assigned_doctor.full_name if log.assigned_doctor else None,
        "assigned_student_id": log.assigned_student_id,
        "assigned_student_name": log.assigned_student.full_name if log.assigned_student else None,
        "status": log.status,
        "stage": stage_val,
        "follow_up_date": sched,
        "followup_date": sched,
        "scheduled_date": sched,
        "channel": log.channel,
        "source_channel": p.get("source_channel") or log.channel,
        "language": log.language,
        "preferred_language": log.language,
        "title": log.title,
        "caller_name": p.get("caller_name") or log.title,
        "phone": p.get("phone"),
        "email": p.get("email"),
        "chief_complaint": p.get("chief_complaint"),
        "notes": p.get("notes"),
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "updated_at": log.updated_at.isoformat() if log.updated_at else None,
    }


def _serialize_tracker_patient(p: Patient) -> dict[str, Any]:
    return {
        "id": p.id,
        "patient_code": p.patient_code,
        "cr_number": p.cr_number,
        "full_name": p.full_name,
        "phone": p.phone,
        "preferred_language": p.preferred_language,
        "tracker_stage": p.tracker_stage,
        "source_channel": p.source_channel,
        "severity_level": p.severity_level,
        "pain_scale": p.pain_scale,
        "doctor_id": p.doctor_id,
        "doctor_name": p.doctor_name,
        "student_id": p.student_id,
        "student_name": p.student_name,
        "attendance_status": p.attendance_status,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _compute_slipping_items(db: Session, current_user: User) -> dict[str, Any]:
    today = date.today()
    overdue_cutoff = today - timedelta(days=7)
    enquiry_cutoff = datetime.now(UTC) - timedelta(days=3)

    p_query = db.query(Patient).filter(Patient.is_deleted == False)
    e_query = db.query(CareAndSystemLog).filter(
        CareAndSystemLog.event_type == "enquiry",
        CareAndSystemLog.status == "open",
    )

    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        stu_id = stu.id if stu else 0
        p_query = p_query.filter(Patient.student_id == stu_id)
        e_query = e_query.filter(CareAndSystemLog.assigned_student_id == stu_id)

    patients = p_query.all()
    patient_map = {p.id: p for p in patients}
    patient_ids = list(patient_map.keys())

    slipping_patients_by_id: dict[int, dict[str, Any]] = {}

    def _add_slip(p: Patient, reason: str, detail: str | None = None, days_overdue: int = 0) -> None:
        entry = slipping_patients_by_id.get(p.id)
        if not entry:
            entry = {
                **_serialize_tracker_patient(p),
                "patient_id": p.id,
                "patient_name": p.full_name,
                "reason": detail or reason,
                "days_overdue": days_overdue,
                "slip_reasons": [],
                "details": [],
            }
            slipping_patients_by_id[p.id] = entry
        if days_overdue > entry.get("days_overdue", 0):
            entry["days_overdue"] = days_overdue
        if reason not in entry["slip_reasons"]:
            entry["slip_reasons"].append(reason)
        if detail:
            entry["details"].append(detail)
            entry["reason"] = "; ".join(entry["details"])

    for p in patients:
        if p.tracker_stage == "slipping":
            _add_slip(p, "flagged_slipping", "Patient stage marked as slipping", 1)

    if patient_ids:
        missed_appts = (
            db.query(Appointment)
            .filter(
                Appointment.patient_id.in_(patient_ids),
                (Appointment.status == "no_show") | (Appointment.is_missed == True),
            )
            .order_by(desc(Appointment.appointment_date))
            .all()
        )
        for appt in missed_appts:
            pat = patient_map.get(appt.patient_id)
            if pat:
                d_late = max(1, (today - appt.appointment_date).days)
                _add_slip(
                    pat,
                    "missed_appointment",
                    f"Missed appointment on {appt.appointment_date.isoformat()} ({appt.missed_reason or 'No-show'})",
                    d_late,
                )

        overdue_followups = (
            db.query(CareAndSystemLog)
            .filter(
                CareAndSystemLog.event_type == "followup",
                CareAndSystemLog.patient_id.in_(patient_ids),
                CareAndSystemLog.status == "pending",
                CareAndSystemLog.scheduled_date < overdue_cutoff,
            )
            .order_by(CareAndSystemLog.scheduled_date.asc())
            .all()
        )
        for fu in overdue_followups:
            pat = patient_map.get(fu.patient_id)
            if pat and fu.scheduled_date:
                days_late = (today - fu.scheduled_date).days
                _add_slip(
                    pat,
                    "overdue_followup",
                    f"Follow-up '{fu.title}' overdue by {days_late} days (scheduled {fu.scheduled_date.isoformat()})",
                    days_late,
                )

    stale_enquiries: list[dict[str, Any]] = []
    for enq in e_query.order_by(CareAndSystemLog.created_at.asc()).all():
        created = enq.created_at
        if created:
            created_utc = created.replace(tzinfo=UTC) if created.tzinfo is None else created
            if created_utc < enquiry_cutoff:
                item = _serialize_enquiry(enq)
                item["slip_reason"] = "uncontacted_enquiry"
                stale_enquiries.append(item)

    return {
        "slipping_patients": list(slipping_patients_by_id.values()),
        "stale_enquiries": stale_enquiries,
        "total_slipping": len(slipping_patients_by_id) + len(stale_enquiries),
    }


@router.get("/overview")
def get_tracker_overview(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Patient tracker funnel stage counts & lists (branch-wide for Doctors/Admin, assigned-only for Students)."""
    p_query = db.query(Patient).filter(Patient.is_deleted == False)
    e_query = db.query(CareAndSystemLog).filter(
        CareAndSystemLog.event_type == "enquiry",
        CareAndSystemLog.status != "converted",
    )

    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        stu_id = stu.id if stu else 0
        p_query = p_query.filter(Patient.student_id == stu_id)
        e_query = e_query.filter(CareAndSystemLog.assigned_student_id == stu_id)

    patients = p_query.order_by(desc(Patient.updated_at)).all()
    enquiries = e_query.order_by(desc(CareAndSystemLog.created_at)).all()
    slipping_data = _compute_slipping_items(db, current_user)
    slipping_ids = {sp["id"] for sp in slipping_data["slipping_patients"]}

    stages: dict[str, list[dict[str, Any]]] = {stage: [] for stage in TRACKER_STAGES}
    for enq in enquiries:
        stages["enquiry"].append(_serialize_enquiry(enq))

    for p in patients:
        serialized = _serialize_tracker_patient(p)
        stage_key = p.tracker_stage if p.tracker_stage in stages else "registered"
        if p.id in slipping_ids and stage_key != "completed":
            stages["slipping"].append(serialized)
            if stage_key != "slipping":
                stages[stage_key].append(serialized)
        else:
            stages[stage_key].append(serialized)

    stage_counts = {stage: len(items) for stage, items in stages.items()}
    return {
        "stage_counts": stage_counts,
        "stages": stages,
        "total_patients": len(patients),
        "total_enquiries": len(enquiries),
        "slipping_count": len(slipping_data["slipping_patients"]) + len(slipping_data["stale_enquiries"]),
    }


@router.get("/enquiries")
def list_enquiries(
    status_filter: str | None = Query(default=None, alias="status"),
    stage: str | None = None,
    channel: str | None = None,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List telephonic and social media enquiries."""
    query = db.query(CareAndSystemLog).filter(CareAndSystemLog.event_type == "enquiry")
    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        query = query.filter(CareAndSystemLog.assigned_student_id == (stu.id if stu else 0))
    if status_filter:
        query = query.filter(CareAndSystemLog.status == status_filter)
    if channel:
        query = query.filter(CareAndSystemLog.channel == channel)

    rows = query.order_by(desc(CareAndSystemLog.created_at), desc(CareAndSystemLog.id)).all()
    items = [_serialize_enquiry(r) for r in rows]
    if stage:
        items = [it for it in items if it.get("stage") == stage]
    return items


@router.post("/enquiries", status_code=status.HTTP_201_CREATED)
def create_enquiry(
    request: Request,
    payload: EnquiryCreate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Log a new telephonic, walk-in, or social media enquiry into CareAndSystemLog."""
    doc_id = payload.assigned_doctor_id
    stu_id = payload.assigned_student_id

    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        if not stu:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Student profile not active."})
        stu_id = stu.id
        if doc_id is None:
            doc_id = stu.doctor_id
    elif doc_id is None and current_user.role in ("doctor", "dentist"):
        doc = resolve_doctor_for_user(db, current_user)
        if doc:
            doc_id = doc.id

    src = payload.source_channel or "phone_enquiry"
    channel = src.replace("_enquiry", "") if src == "phone_enquiry" else src
    follow_dt = payload.follow_up_date or payload.followup_date or payload.scheduled_date

    enq = CareAndSystemLog(
        event_type="enquiry",
        patient_id=None,
        actor_user_id=current_user.id,
        assigned_doctor_id=doc_id,
        assigned_student_id=stu_id,
        status="open",
        scheduled_date=follow_dt,
        channel=channel,
        language=payload.preferred_language,
        title=payload.title or f"Enquiry — {payload.caller_name}",
        payload_json={
            "caller_name": payload.caller_name.strip(),
            "phone": payload.phone.strip(),
            "email": payload.email,
            "source_channel": src,
            "chief_complaint": payload.chief_complaint,
            "notes": payload.notes,
            "stage": "enquiry",
        },
    )
    db.add(enq)
    db.commit()
    db.refresh(enq)

    log_audit_event(
        db=db,
        action="ENQUIRY_CREATE",
        user=current_user,
        entity_name="Enquiry",
        entity_id=str(enq.id),
        details={"caller_name": payload.caller_name, "source_channel": src},
        request=request,
    )
    return _serialize_enquiry(enq)


@router.patch("/enquiries/{enquiry_id}")
def update_enquiry(
    request: Request,
    enquiry_id: int,
    payload: EnquiryUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update enquiry status, follow-up date, notes, or assignment."""
    enq = (
        db.query(CareAndSystemLog)
        .filter(CareAndSystemLog.id == enquiry_id, CareAndSystemLog.event_type == "enquiry")
        .first()
    )
    if not enq:
        raise HTTPException(status_code=404, detail={"code": "ENQUIRY_NOT_FOUND", "message": "Enquiry not found."})

    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        if not stu or enq.assigned_student_id != stu.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only update enquiries assigned to you."},
            )

    pjson = dict(enq.payload_json or {})
    if payload.status is not None:
        enq.status = payload.status
    if payload.stage is not None:
        pjson["stage"] = payload.stage
    follow_dt = payload.follow_up_date or payload.followup_date or payload.scheduled_date
    if follow_dt is not None:
        enq.scheduled_date = follow_dt
    if payload.notes is not None:
        pjson["notes"] = payload.notes
    if payload.chief_complaint is not None:
        pjson["chief_complaint"] = payload.chief_complaint
    if current_user.role != "student":
        if payload.assigned_doctor_id is not None:
            enq.assigned_doctor_id = payload.assigned_doctor_id
        if payload.assigned_student_id is not None:
            enq.assigned_student_id = payload.assigned_student_id
    if payload.tracker_stage and enq.patient_id:
        pat = db.query(Patient).filter(Patient.id == enq.patient_id).first()
        if pat:
            pat.tracker_stage = payload.tracker_stage
    enq.payload_json = pjson

    db.commit()
    db.refresh(enq)

    log_audit_event(
        db=db,
        action="ENQUIRY_UPDATE",
        user=current_user,
        entity_name="Enquiry",
        entity_id=str(enq.id),
        details={"status": enq.status},
        request=request,
    )
    return _serialize_enquiry(enq)


@router.post("/enquiries/{enquiry_id}/convert", status_code=status.HTTP_201_CREATED)
def convert_enquiry_to_patient(
    request: Request,
    enquiry_id: int,
    payload: EnquiryConvertRequest | None = Body(default=None),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """One-click conversion of an enquiry into a registered Patient record."""
    enq = (
        db.query(CareAndSystemLog)
        .filter(CareAndSystemLog.id == enquiry_id, CareAndSystemLog.event_type == "enquiry")
        .first()
    )
    if not enq:
        raise HTTPException(status_code=404, detail={"code": "ENQUIRY_NOT_FOUND", "message": "Enquiry not found."})

    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        if not stu or enq.assigned_student_id != stu.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only convert enquiries assigned to you."},
            )

    if enq.status == "converted" and enq.patient_id:
        existing_pat = db.query(Patient).filter(Patient.id == enq.patient_id, Patient.is_deleted == False).first()
        if existing_pat:
            return {
                "message": "Enquiry already converted.",
                "patient": to_patient_detail(existing_pat),
                "enquiry": _serialize_enquiry(enq),
            }

    pjson = enq.payload_json or {}
    body = payload or EnquiryConvertRequest()

    full_name = body.full_name or pjson.get("caller_name") or enq.title or "Enquiry Patient"
    phone = body.phone or pjson.get("phone") or "+91 00000 00000"
    email = body.email or pjson.get("email")

    patient_data = PatientCreate(
        full_name=None if (body.first_name and body.last_name) else full_name,
        first_name=body.first_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth or date(1990, 1, 1),
        gender=body.gender or "Other",
        phone=phone,
        email=email,
        address=body.address,
        preferred_language=body.preferred_language or enq.language or "en",
        doctor_id=body.doctor_id if body.doctor_id is not None else enq.assigned_doctor_id,
        student_id=body.student_id if body.student_id is not None else enq.assigned_student_id,
        cr_number=body.cr_number,
        disease_categories=body.disease_categories,
        source_channel=pjson.get("source_channel") or enq.channel or "phone_enquiry",
        tracker_stage="registered",
        dental_history={"chief_complaint": pjson.get("chief_complaint")} if pjson.get("chief_complaint") else None,
    )
    patient = PatientService.create_patient(db, data=patient_data, current_user=current_user, request=request)

    enq.status = "converted"
    enq.patient_id = patient.id
    pjson = dict(enq.payload_json or {})
    pjson["stage"] = "registered"
    enq.payload_json = pjson
    db.commit()
    db.refresh(enq)

    return {
        "message": f"Converted enquiry to patient {patient.full_name}.",
        "patient": to_patient_detail(patient),
        "enquiry": _serialize_enquiry(enq),
    }


@router.get("/slipping")
def get_slipping_patients(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Detect slipping/drop-off patients (missed appointments, >7d overdue follow-ups, >3d open enquiries)."""
    return _compute_slipping_items(db, current_user)
