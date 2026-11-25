from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.security.permissions import ROLE_PERMISSIONS, Permission, Role
from app.security.tokens import decode_access_token

security_scheme = HTTPBearer(auto_error=False)


def get_token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> str | None:
    """Retrieve access token from Bearer Authorization header or http-only cookie."""
    if credentials:
        return credentials.credentials
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    return None


def get_current_user(
    request: Request,
    token: str | None = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    """Validate JWT access token, token_version, active status, and active student presence."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication credentials were not provided"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Access token is invalid or has expired"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN_PAYLOAD", "message": "Token does not contain user identification"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User associated with this token does not exist"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Instant revocation check: is_active, revoked_at, token_version match
    if not user.is_active or user.revoked_at is not None or payload.get("tv") != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_REVOKED", "message": "Account access has been revoked"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # For student role, confirm an active non-revoked Student profile row exists
    if user.role == Role.STUDENT:
        active_student = db.query(Student).filter(
            Student.user_id == user.id,
            Student.is_active == True,
            Student.revoked_at.is_(None),
        ).first()
        if not active_student:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_REVOKED", "message": "Account access has been revoked"},
                headers={"WWW-Authenticate": "Bearer"},
            )

    if user.locked_until:
        locked = user.locked_until.replace(tzinfo=UTC) if user.locked_until.tzinfo is None else user.locked_until
        if locked > datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ACCOUNT_LOCKED", "message": "Account temporarily locked due to failed login attempts."},
            )

    return user


def require_roles(*allowed_roles: str):
    """
    Enforce that current authenticated user belongs to one of allowed roles.
    - 'doctor' and 'dentist' are interchangeable.
    - Designated admin doctor (doctor.is_admin == True) satisfies 'admin'.
    - System 'admin' always passes.
    """
    expanded_roles = set(allowed_roles)
    if Role.DOCTOR in expanded_roles or Role.DENTIST in expanded_roles:
        expanded_roles.update({Role.DOCTOR, Role.DENTIST})

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == Role.ADMIN:
            return current_user
        if Role.ADMIN in expanded_roles and current_user.is_admin:
            return current_user
        if current_user.role in expanded_roles:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN_ROLE",
                "message": f"User role '{current_user.role}' is not authorized to access this resource. Allowed: {list(allowed_roles)}",
            },
        )

    return role_checker


def require_permission(permission: Permission):
    """Enforce granular permission check."""

    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.is_admin and permission in ROLE_PERMISSIONS[Role.ADMIN]:
            return current_user
        user_role = Role(current_user.role) if current_user.role in [r.value for r in Role] else None
        if not user_role or permission not in ROLE_PERMISSIONS.get(user_role, set()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN_PERMISSION",
                    "message": f"Permission '{permission.value}' is required for this operation.",
                },
            )
        return current_user

    return permission_checker


def resolve_doctor_for_user(db: Session, user: User) -> Doctor | None:
    """Resolve the active Doctor profile associated with a User."""
    doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doc and user.email:
        doc = db.query(Doctor).filter(Doctor.email == user.email.lower()).first()
    return doc


def resolve_student_for_user(db: Session, user: User) -> Student | None:
    """Resolve the active non-revoked Student profile associated with a User."""
    return db.query(Student).filter(
        Student.user_id == user.id,
        Student.is_active == True,
        Student.revoked_at.is_(None),
    ).first()


def verify_patient_access(
    db: Session,
    current_user: User,
    patient_id: int,
    *,
    allow_receptionist: bool = False,
    require_write: bool = False,
    allow_patient_self: bool = False,
) -> Patient:
    """
    Centralized RBAC & tenant isolation guard for every patient-scoped resource:
    - admin / designated admin doctor / doctor / dentist: unrestricted branch-wide access.
    - student: ONLY if patient.student_id == current_student.id (else 403).
    - patient: ALWAYS 403 on staff clinical routes unless allow_patient_self=True and patient owns record.
    - receptionist: ALWAYS 403 unless allow_receptionist=True (and never write).
    """
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.is_deleted == False).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATIENT_NOT_FOUND", "message": f"Patient with ID {patient_id} does not exist."},
        )

    if current_user.role == Role.ADMIN or current_user.is_admin:
        return patient

    if current_user.role in (Role.DOCTOR, Role.DENTIST):
        return patient

    if current_user.role == Role.STUDENT:
        student = resolve_student_for_user(db, current_user)
        if not student or patient.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only access patient records assigned to you."},
            )
        return patient

    if current_user.role == Role.PATIENT:
        if allow_patient_self and not require_write and current_user.patient_id == patient.id:
            return patient
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Patients cannot access internal clinical endpoints."},
        )

    if current_user.role == Role.RECEPTIONIST:
        if allow_receptionist and not require_write:
            return patient
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Receptionist access is restricted to patient attendance."},
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "FORBIDDEN", "message": "You are not authorized to access this patient record."},
    )
