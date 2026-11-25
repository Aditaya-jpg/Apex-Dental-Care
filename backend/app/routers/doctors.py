from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.security.dependencies import require_roles
from app.security.hashing import hash_password

router = APIRouter(prefix="/doctors", tags=["Doctors Management"])


def _build_doctor_response(db: Session, doctor: Doctor) -> DoctorResponse:
    stu_cnt = (
        db.query(func.count(Student.id))
        .filter(Student.doctor_id == doctor.id, Student.is_active == True, Student.revoked_at.is_(None))
        .scalar()
        or 0
    )
    pat_cnt = (
        db.query(func.count(Patient.id))
        .filter(Patient.doctor_id == doctor.id, Patient.is_deleted == False)
        .scalar()
        or 0
    )
    resp = DoctorResponse.model_validate(doctor)
    resp.students_count = stu_cnt
    resp.patients_count = pat_cnt
    return resp


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def register_doctor(
    request: Request,
    payload: DoctorCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Register a new doctor in doctors and users tables."""
    email_lower = payload.email.lower()
    if (
        db.query(Doctor).filter(Doctor.email == email_lower).first()
        or db.query(User).filter(User.email == email_lower).first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_EMAIL", "message": f"A doctor with email {payload.email} already exists."},
        )

    if db.query(Doctor).filter(Doctor.license_number == payload.license_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DUPLICATE_REGISTRATION",
                "message": f"License/Registration number {payload.license_number} already exists.",
            },
        )

    pw_hash = hash_password(payload.password)
    base_username = email_lower.split("@")[0]
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}_{counter}"
        counter += 1

    is_active = bool(payload.is_active)
    user = User(
        email=email_lower,
        username=username,
        password_hash=pw_hash,
        full_name=payload.full_name,
        role="doctor",
        phone=payload.phone,
        is_active=is_active,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        full_name=payload.full_name,
        email=email_lower,
        phone=payload.phone,
        specialization=payload.specialization,
        department=payload.department or "Oral Health Sciences",
        license_number=payload.license_number,
        cabin_operatory=payload.cabin_operatory or "Operatory 1",
        is_admin=payload.is_admin,
        google_calendar_id=payload.google_calendar_id,
        is_active=is_active,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    log_audit_event(
        db=db,
        action="DOCTOR_CREATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={
            "name": doctor.full_name,
            "email": doctor.email,
            "license_number": doctor.license_number,
            "cabin_operatory": doctor.cabin_operatory,
            "is_admin": doctor.is_admin,
        },
        request=request,
    )

    return _build_doctor_response(db, doctor)


@router.get("", response_model=list[DoctorResponse])
def list_doctors(
    search: str | None = None,
    include_inactive: bool = False,
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """List doctors for clinic staff (Patients blocked with 403). Staff see all active doctors."""
    query = db.query(Doctor)

    is_admin_actor = current_user.role == "admin" or current_user.is_admin
    if not (is_admin_actor and include_inactive):
        query = query.filter(Doctor.is_active == True)

    if search:
        st = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Doctor.full_name.ilike(st),
                Doctor.email.ilike(st),
                Doctor.specialization.ilike(st),
                Doctor.department.ilike(st),
                Doctor.license_number.ilike(st),
                Doctor.cabin_operatory.ilike(st),
            )
        )

    doctors = query.order_by(Doctor.id.asc()).all()
    return [_build_doctor_response(db, d) for d in doctors]


@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(
    doctor_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """Retrieve details of a specific doctor (Staff-only; Patients blocked with 403)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."},
        )
    return _build_doctor_response(db, doctor)


def _apply_doctor_update(db: Session, doctor: Doctor, payload: DoctorUpdate, current_user: User, request: Request) -> DoctorResponse:
    raw_data = payload.model_dump(exclude_unset=True)
    new_pw = raw_data.pop("password", None)

    # Map aliases to canonical Doctor columns
    if "doctor_name" in raw_data and "full_name" not in raw_data:
        raw_data["full_name"] = raw_data.pop("doctor_name")
    else:
        raw_data.pop("doctor_name", None)

    if "phone_number" in raw_data and "phone" not in raw_data:
        raw_data["phone"] = raw_data.pop("phone_number")
    else:
        raw_data.pop("phone_number", None)

    if "qualification" in raw_data and "department" not in raw_data:
        raw_data["department"] = raw_data.pop("qualification")
    else:
        raw_data.pop("qualification", None)

    if "registration_number" in raw_data and "license_number" not in raw_data:
        raw_data["license_number"] = raw_data.pop("registration_number")
    else:
        raw_data.pop("registration_number", None)

    if "account_status" in raw_data and "is_active" not in raw_data:
        raw_data["is_active"] = raw_data.pop("account_status") == "active"
    else:
        raw_data.pop("account_status", None)

    if "email" in raw_data and raw_data["email"]:
        raw_data["email"] = raw_data["email"].lower()

    for k, v in raw_data.items():
        if hasattr(doctor, k):
            setattr(doctor, k, v)

    # Synchronize linked User
    if doctor.user_id:
        user = db.query(User).filter(User.id == doctor.user_id).first()
        if user:
            if "full_name" in raw_data:
                user.full_name = raw_data["full_name"]
            if "phone" in raw_data:
                user.phone = raw_data["phone"]
            if "email" in raw_data:
                user.email = raw_data["email"]
            if "is_active" in raw_data:
                new_active = bool(raw_data["is_active"])
                if not new_active and user.is_active:
                    user.token_version += 1
                    user.refresh_tokens_json = []
                    user.revoked_at = datetime.now(UTC)
                elif new_active:
                    user.revoked_at = None
                user.is_active = new_active
            if new_pw:
                user.password_hash = hash_password(new_pw)

    db.commit()
    db.refresh(doctor)

    log_audit_event(
        db=db,
        action="DOCTOR_UPDATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={"updated_fields": list(raw_data.keys()), "is_admin": doctor.is_admin},
        request=request,
    )

    return _build_doctor_response(db, doctor)


@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: int,
    payload: DoctorUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Edit doctor details, toggle is_admin, cabin_operatory, department, or active status."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."},
        )
    return _apply_doctor_update(db, doctor, payload, current_user, request)


@router.patch("/{doctor_id}", response_model=DoctorResponse)
def patch_doctor(
    doctor_id: int,
    payload: DoctorUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Partially update doctor (e.g., toggle is_admin or cabin_operatory)."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."},
        )
    return _apply_doctor_update(db, doctor, payload, current_user, request)


@router.delete("/{doctor_id}", response_model=MessageResponse)
def delete_doctor(
    doctor_id: int,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Deactivate doctor and immediately revoke active JWT sessions."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."},
        )

    doctor.is_active = False
    if doctor.user_id:
        user = db.query(User).filter(User.id == doctor.user_id).first()
        if user:
            user.is_active = False
            user.token_version += 1
            user.refresh_tokens_json = []
            user.revoked_at = datetime.now(UTC)

    db.commit()

    log_audit_event(
        db=db,
        action="DOCTOR_DEACTIVATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={"doctor_name": doctor.full_name},
        request=request,
    )

    return MessageResponse(message=f"Doctor {doctor.full_name} has been deactivated.")
