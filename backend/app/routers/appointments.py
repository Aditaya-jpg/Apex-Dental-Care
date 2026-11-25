from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.constants import APPOINTMENT_TYPES
from app.database import get_db
from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentMissedCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AppointmentTypeResponse,
    AppointmentUpdate,
)
from app.security.dependencies import require_roles
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["Appointment Management"])


def _to_appointment_response(a: Appointment) -> AppointmentResponse:
    resp = AppointmentResponse.model_validate(a)
    resp.dentist_id = a.doctor_id
    resp.patient_name = a.patient.full_name if a.patient else None
    resp.patient_code = a.patient.patient_code if a.patient else None
    resp.cr_number = a.patient.cr_number if a.patient else None
    resp.doctor_name = a.doctor.full_name if a.doctor else None
    resp.dentist_name = resp.doctor_name
    resp.student_name = a.student.full_name if a.student else None
    resp.appointment_type_name = a.appointment_type
    return resp


@router.get("/types", response_model=list[AppointmentTypeResponse])
def get_appointment_types(
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
):
    """Retrieve catalog of appointment types with colors and default durations (zero fees)."""
    return [AppointmentTypeResponse(**t) for t in APPOINTMENT_TYPES]


@router.get("", response_model=list[AppointmentResponse])
def list_appointments(
    appointment_date: date | None = None,
    doctor_id: int | None = None,
    dentist_id: int | None = None,
    patient_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    operatory: str | None = None,
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """List appointments filtered by date, doctor, operatory, patient, or status."""
    appts = AppointmentService.get_appointments(
        db,
        current_user=current_user,
        appointment_date=appointment_date,
        doctor_id=doctor_id or dentist_id,
        patient_id=patient_id,
        status_filter=status_filter,
        operatory=operatory,
    )
    if current_user.role == "receptionist":
        # Minimal attendance-only projection (strip clinical notes)
        items = []
        for a in appts:
            r = _to_appointment_response(a)
            r.notes = None
            r.reason = None
            items.append(r)
        return items
    return [_to_appointment_response(a) for a in appts]


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    request: Request,
    payload: AppointmentCreate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Book an appointment with doctor and operatory conflict prevention."""
    appt = AppointmentService.create_appointment(db, data=payload, current_user=current_user, request=request)
    return _to_appointment_response(appt)


@router.post("/missed", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def log_missed_appointment(
    request: Request,
    payload: AppointmentMissedCreate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Log a missed patient or missed appointment directly from Doctor Dashboard."""
    appt = AppointmentService.log_missed_appointment(db, data=payload, current_user=current_user, request=request)
    return _to_appointment_response(appt)


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve appointment details with RBAC patient scoping."""
    appt = AppointmentService.get_appointment_by_id(db, appointment_id, current_user)
    return _to_appointment_response(appt)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    request: Request,
    appointment_id: int,
    payload: AppointmentUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Update or reschedule appointment."""
    appt = AppointmentService.update_appointment(
        db,
        appointment_id=appointment_id,
        data=payload,
        current_user=current_user,
        request=request,
    )
    return _to_appointment_response(appt)


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
def update_appointment_status(
    request: Request,
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Change appointment status (confirmed, cancelled, no_show, completed)."""
    appt = AppointmentService.update_status(
        db,
        appointment_id=appointment_id,
        data=payload,
        current_user=current_user,
        request=request,
    )
    return _to_appointment_response(appt)
