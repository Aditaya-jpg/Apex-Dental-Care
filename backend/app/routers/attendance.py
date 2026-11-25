from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.security.dependencies import require_roles

router = APIRouter(prefix="/attendance", tags=["Patient Attendance"])


class AttendanceMarkRequest(BaseModel):
    status: str = Field(pattern="^(pending|checked_in|present|in_treatment|completed|missed)$")
    notes: str | None = None


class WalkInCheckInRequest(BaseModel):
    identifier: str | None = None
    cr_number: str | None = None
    patient_code: str | None = None
    patient_id: int | None = None
    doctor_id: int | None = None
    operatory: str = "Operatory 1"
    notes: str | None = None


class AttendanceItemResponse(BaseModel):
    id: int
    appointment_id: int
    patient_id: int
    cr_number: str | None = None
    patient_code: str
    full_name: str
    phone: str
    doctor_id: int
    doctor_name: str | None = None
    operatory: str
    appointment_type: str
    appointment_date: date
    start_time: time
    end_time: time
    status: str
    attendance_status: str
    attendance_marked_at: datetime | None = None
    is_missed: bool = False


def _to_attendance_item(appt: Appointment) -> AttendanceItemResponse:
    return AttendanceItemResponse(
        id=appt.id,
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        cr_number=appt.patient.cr_number if appt.patient else None,
        patient_code=appt.patient.patient_code if appt.patient else "",
        full_name=appt.patient.full_name if appt.patient else "",
        phone=appt.patient.phone if appt.patient else "",
        doctor_id=appt.doctor_id,
        doctor_name=appt.doctor.full_name if appt.doctor else None,
        operatory=appt.operatory,
        appointment_type=appt.appointment_type,
        appointment_date=appt.appointment_date,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        attendance_status=appt.attendance_status,
        attendance_marked_at=appt.attendance_marked_at,
        is_missed=appt.is_missed,
    )


@router.get("/today")
def get_today_attendance(
    target_date: date | None = Query(default=None, alias="date"),
    current_user: User = Depends(require_roles("admin", "receptionist")),
    db: Session = Depends(get_db),
):
    """
    Attendance Desk: Return today's (or specified date's) appointments with minimal demographic & attendance fields only.
    Zero clinical notes, charts, or diagnoses are exposed.
    """
    day = target_date or date.today()
    appts = (
        db.query(Appointment)
        .filter(Appointment.appointment_date == day, Appointment.status != "cancelled")
        .order_by(Appointment.start_time.asc())
        .all()
    )

    items = [_to_attendance_item(a).model_dump(mode="json") for a in appts]
    summary = {
        "total": len(appts),
        "pending": sum(1 for a in appts if a.attendance_status == "pending"),
        "checked_in": sum(1 for a in appts if a.attendance_status in ("checked_in", "present")),
        "in_treatment": sum(1 for a in appts if a.attendance_status == "in_treatment"),
        "completed": sum(1 for a in appts if a.attendance_status == "completed"),
        "missed": sum(1 for a in appts if a.attendance_status == "missed" or a.is_missed),
    }

    return {
        "date": day.isoformat(),
        "summary": summary,
        "items": items,
    }


@router.patch("/{appointment_id}/mark", response_model=AttendanceItemResponse)
def mark_attendance(
    appointment_id: int,
    payload: AttendanceMarkRequest,
    request: Request,
    current_user: User = Depends(require_roles("admin", "receptionist")),
    db: Session = Depends(get_db),
):
    """Mark attendance for an appointment (checked_in, present, in_treatment, completed, missed)."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "APPOINTMENT_NOT_FOUND", "message": f"Appointment {appointment_id} not found."},
        )

    now = datetime.now(UTC)
    appt.attendance_status = payload.status
    appt.attendance_marked_at = now
    appt.attendance_marked_by = current_user.id

    patient = appt.patient
    if payload.status in ("checked_in", "present"):
        appt.status = "checked_in"
        appt.is_missed = False
        if patient:
            patient.attendance_status = "checked_in"
            patient.last_attendance_at = now
    elif payload.status == "in_treatment":
        appt.status = "in_treatment"
        appt.is_missed = False
        if patient:
            patient.attendance_status = "in_treatment"
            patient.last_attendance_at = now
    elif payload.status == "completed":
        appt.status = "completed"
        appt.is_missed = False
        if patient:
            patient.attendance_status = "completed"
            patient.last_attendance_at = now
    elif payload.status == "missed":
        appt.status = "no_show"
        appt.is_missed = True
        if payload.notes:
            appt.missed_reason = payload.notes
        if patient:
            patient.attendance_status = "missed"
            patient.tracker_stage = "slipping"
    else:
        appt.is_missed = False

    db.commit()
    db.refresh(appt)

    log_audit_event(
        db=db,
        action="ATTENDANCE_MARK",
        user=current_user,
        entity_name="Appointment",
        entity_id=str(appt.id),
        patient_id=appt.patient_id,
        details={"attendance_status": payload.status, "appointment_id": appt.id},
        request=request,
    )

    return _to_attendance_item(appt)


@router.post("/walkin-checkin", response_model=AttendanceItemResponse, status_code=status.HTTP_201_CREATED)
def walkin_checkin(
    payload: WalkInCheckInRequest,
    request: Request,
    current_user: User = Depends(require_roles("admin", "receptionist")),
    db: Session = Depends(get_db),
):
    """Mark attendance for a walk-in registered patient by CR Number, Patient Code, or Patient ID."""
    query = db.query(Patient).filter(Patient.is_deleted == False)
    patient: Patient | None = None
    if payload.patient_id:
        patient = query.filter(Patient.id == payload.patient_id).first()
    elif payload.cr_number:
        patient = query.filter(Patient.cr_number == payload.cr_number.strip()).first()
    elif payload.patient_code:
        patient = query.filter(Patient.patient_code == payload.patient_code.strip()).first()
    elif payload.identifier:
        ident = payload.identifier.strip()
        patient = (
            query.filter(
                (Patient.cr_number == ident) | (Patient.patient_code == ident) | (Patient.phone == ident)
            ).first()
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PATIENT_IDENTIFIER_REQUIRED", "message": "Provide cr_number, patient_code, or patient_id."},
        )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATIENT_NOT_FOUND", "message": "Registered patient not found for provided identifier."},
        )

    now = datetime.now(UTC)
    today = date.today()

    # Check if patient already has an appointment today
    appt = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.appointment_date == today,
            Appointment.status.notin_(["cancelled", "completed"]),
        )
        .first()
    )

    if appt:
        appt.attendance_status = "checked_in"
        appt.status = "checked_in"
        appt.attendance_marked_at = now
        appt.attendance_marked_by = current_user.id
    else:
        target_doc_id = payload.doctor_id or patient.doctor_id
        doc = None
        if target_doc_id:
            doc = db.query(Doctor).filter(Doctor.id == target_doc_id, Doctor.is_active == True).first()
        if not doc:
            doc = db.query(Doctor).filter(Doctor.is_active == True).order_by(Doctor.id.asc()).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "NO_ACTIVE_DOCTOR", "message": "No active doctor available for walk-in check-in."},
            )

        now_local = datetime.now()
        start_t = now_local.time().replace(second=0, microsecond=0)
        end_dt = now_local + timedelta(minutes=30)
        end_t = end_dt.time().replace(second=0, microsecond=0)
        if end_t <= start_t:
            end_t = time(23, 59)

        appt = Appointment(
            patient_id=patient.id,
            doctor_id=doc.id,
            student_id=patient.student_id,
            operatory=payload.operatory or doc.cabin_operatory or "Operatory 1",
            appointment_type="Walk-In Check-In",
            appointment_date=today,
            start_time=start_t,
            end_time=end_t,
            status="checked_in",
            attendance_status="checked_in",
            attendance_marked_at=now,
            attendance_marked_by=current_user.id,
            reason="Walk-in clinic check-in",
        )
        db.add(appt)

    patient.attendance_status = "checked_in"
    patient.last_attendance_at = now
    db.commit()
    db.refresh(appt)

    log_audit_event(
        db=db,
        action="WALKIN_CHECKIN",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"cr_number": patient.cr_number, "appointment_id": appt.id},
        request=request,
    )

    return _to_attendance_item(appt)
