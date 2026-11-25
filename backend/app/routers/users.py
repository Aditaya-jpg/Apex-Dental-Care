from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.user import (
    DentistProfileResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.security.dependencies import require_roles
from app.security.hashing import hash_password

router = APIRouter(prefix="/users", tags=["User Management"])


def _to_user_response(user: User) -> UserResponse:
    doc_prof = None
    if user.doctor_profile:
        d = user.doctor_profile
        doc_prof = DentistProfileResponse(
            id=d.id,
            user_id=d.user_id,
            license_number=d.license_number,
            specialization=d.specialization,
            qualifications=d.department,
            department=d.department,
            cabin_number=d.cabin_operatory,
            cabin_operatory=d.cabin_operatory,
            is_admin=d.is_admin,
            is_active=d.is_active,
        )
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        patient_id=user.patient_id,
        doctor_id=user.doctor_id,
        student_id=user.student_id,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        doctor_profile=doc_prof,
        dentist_profile=doc_prof,
    )


@router.get("", response_model=list[UserResponse])
def get_users(
    role: str | None = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Retrieve all system users."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return [_to_user_response(u) for u in query.order_by(User.id.asc()).all()]


@router.get("/doctors", response_model=list[UserResponse])
@router.get("/dentists", response_model=list[UserResponse])
def get_active_doctors(
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """Retrieve list of all active doctors with doctor_profile-compatible data (Patients blocked with 403)."""
    active_docs = (
        db.query(Doctor)
        .join(User, Doctor.user_id == User.id)
        .filter(Doctor.is_active == True, User.is_active == True, User.revoked_at.is_(None))
        .order_by(Doctor.id.asc())
        .all()
    )
    return [_to_user_response(d.user) for d in active_docs if d.user]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Create a new system user with optional doctor profile."""
    email_lower = payload.email.lower()
    if db.query(User).filter((User.email == email_lower) | (User.username == payload.username)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "USER_EXISTS", "message": "A user with this email or username already exists."},
        )

    normalized_role = "doctor" if payload.role == "dentist" else payload.role
    user = User(
        email=email_lower,
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=normalized_role,
        phone=payload.phone,
        is_active=payload.is_active,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(user)
    db.flush()

    if normalized_role == "doctor" and payload.dentist_profile:
        dp = payload.dentist_profile
        doctor = Doctor(
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            license_number=dp.license_number,
            specialization=dp.specialization,
            department=dp.department or dp.qualifications or "Oral Health Sciences",
            cabin_operatory=dp.cabin_operatory or dp.cabin_number or "Operatory 1",
            is_admin=dp.is_admin,
            is_active=dp.is_active,
        )
        db.add(doctor)

    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="USER_CREATE",
        user=current_user,
        entity_name="User",
        entity_id=str(user.id),
        details={"created_user": user.email, "role": user.role},
    )

    return _to_user_response(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Update user details, role, or active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found."},
        )

    update_dict = payload.model_dump(exclude_unset=True)
    doctor_data = update_dict.pop("dentist_profile", None)
    pwd = update_dict.pop("password", None)
    if pwd:
        user.password_hash = hash_password(pwd)

    if "role" in update_dict and update_dict["role"] == "dentist":
        update_dict["role"] = "doctor"
    if "email" in update_dict and update_dict["email"]:
        update_dict["email"] = update_dict["email"].lower()

    if "is_active" in update_dict:
        new_active = bool(update_dict["is_active"])
        if not new_active and user.is_active:
            user.token_version += 1
            user.refresh_tokens_json = []
            user.revoked_at = datetime.now(UTC)
        elif new_active:
            user.revoked_at = None

    for k, v in update_dict.items():
        if hasattr(user, k):
            setattr(user, k, v)

    if doctor_data and user.role == "doctor":
        doc = user.doctor_profile
        if not doc:
            doc = Doctor(
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                phone=user.phone,
                license_number=doctor_data.get("license_number", f"PGI-DOC-{user.id}"),
            )
            db.add(doc)
        if doctor_data.get("specialization") is not None:
            doc.specialization = doctor_data["specialization"]
        if doctor_data.get("department") or doctor_data.get("qualifications"):
            doc.department = doctor_data.get("department") or doctor_data.get("qualifications")
        if doctor_data.get("cabin_operatory") or doctor_data.get("cabin_number"):
            doc.cabin_operatory = doctor_data.get("cabin_operatory") or doctor_data.get("cabin_number")
        if doctor_data.get("is_admin") is not None:
            doc.is_admin = doctor_data["is_admin"]
        if doctor_data.get("is_active") is not None:
            doc.is_active = doctor_data["is_active"]

    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="USER_UPDATE",
        user=current_user,
        entity_name="User",
        entity_id=str(user.id),
        details={"updated_fields": list(update_dict.keys())},
    )

    return _to_user_response(user)
