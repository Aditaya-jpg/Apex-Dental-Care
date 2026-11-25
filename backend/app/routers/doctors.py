from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import Dentist, User
from app.schemas.common import MessageResponse
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.security.dependencies import get_current_user, require_roles
from app.security.hashing import hash_password

router = APIRouter(prefix="/doctors", tags=["Doctors Management"])


@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def register_doctor(
    request: Request,
    payload: DoctorCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Admin-only: Register a new doctor."""
    # Check duplicate email
    if db.query(Doctor).filter(Doctor.email == payload.email.lower()).first() or \
       db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_EMAIL", "message": f"A doctor with email {payload.email} already exists."}
        )

    # Check duplicate registration number
    if db.query(Doctor).filter(Doctor.registration_number == payload.registration_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_REGISTRATION", "message": f"Registration number {payload.registration_number} already exists."}
        )

    pw_hash = hash_password(payload.password)
    username = payload.email.lower().split("@")[0]
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}_{counter}"
        counter += 1

    # 1. Create User account
    user = User(
        email=payload.email.lower(),
        username=username,
        hashed_password=pw_hash,
        full_name=payload.doctor_name,
        role="doctor",
        phone=payload.phone_number,
        is_active=(payload.account_status == "active")
    )
    db.add(user)
    db.flush()

    # 2. Create Doctor entry
    doctor = Doctor(
        doctor_name=payload.doctor_name,
        email=payload.email.lower(),
        phone_number=payload.phone_number,
        qualification=payload.qualification,
        specialization=payload.specialization,
        registration_number=payload.registration_number,
        password_hash=pw_hash,
        account_status=payload.account_status,
        user_id=user.id
    )
    db.add(doctor)
    db.flush()

    user.doctor_id = doctor.id

    # 3. Create Dentist compatibility record
    dentist = Dentist(
        user_id=user.id,
        license_number=payload.registration_number,
        specialization=payload.specialization,
        qualifications=payload.qualification,
        cabin_number="Operatory",
        is_active=(payload.account_status == "active")
    )
    db.add(dentist)

    db.commit()
    db.refresh(doctor)

    log_audit_event(
        db=db,
        action="DOCTOR_CREATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={"name": doctor.doctor_name, "email": doctor.email, "reg_no": doctor.registration_number},
        request=request
    )

    resp = DoctorResponse.model_validate(doctor)
    resp.students_count = 0
    resp.patients_count = 0
    return resp


@router.get("", response_model=list[DoctorResponse])
def list_doctors(
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List doctors. Admins see all doctors; Doctors see themselves."""
    query = db.query(Doctor)

    if current_user.role in ["dentist", "doctor"]:
        # Doctor only sees themselves
        c_doc_id = current_user.doctor_id
        if not c_doc_id:
            doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
            c_doc_id = doc.id if doc else 0
        query = query.filter(Doctor.id == c_doc_id)
    elif current_user.role != "admin":
        # Students / Receptionists can see active doctors list for reference
        query = query.filter(Doctor.account_status == "active")

    if search:
        st = f"%{search.strip()}%"
        query = query.filter(
            (Doctor.doctor_name.ilike(st)) |
            (Doctor.email.ilike(st)) |
            (Doctor.specialization.ilike(st)) |
            (Doctor.registration_number.ilike(st))
        )

    doctors = query.order_by(Doctor.id.asc()).all()
    results = []
    for d in doctors:
        stu_cnt = db.query(func.count(Student.id)).filter(Student.doctor_id == d.id).scalar() or 0
        pat_cnt = db.query(func.count(Patient.id)).filter(Patient.doctor_id == d.id, Patient.is_deleted == False).scalar() or 0
        resp = DoctorResponse.model_validate(d)
        resp.students_count = stu_cnt
        resp.patients_count = pat_cnt
        results.append(resp)

    return results


@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(
    doctor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve details of a specific doctor."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."}
        )

    if current_user.role in ["dentist", "doctor"] and current_user.doctor_id != doctor.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You can only view your own doctor record."}
        )

    stu_cnt = db.query(func.count(Student.id)).filter(Student.doctor_id == doctor.id).scalar() or 0
    pat_cnt = db.query(func.count(Patient.id)).filter(Patient.doctor_id == doctor.id, Patient.is_deleted == False).scalar() or 0

    resp = DoctorResponse.model_validate(doctor)
    resp.students_count = stu_cnt
    resp.patients_count = pat_cnt
    return resp


@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: int,
    payload: DoctorUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Admin-only: Edit doctor details or toggle active status."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."}
        )

    update_data = payload.model_dump(exclude_unset=True)
    new_pw = update_data.pop("password", None)

    for k, v in update_data.items():
        setattr(doctor, k, v)

    # Synchronize User account if exists
    if doctor.user_id:
        user = db.query(User).filter(User.id == doctor.user_id).first()
        if user:
            if "doctor_name" in update_data:
                user.full_name = update_data["doctor_name"]
            if "phone_number" in update_data:
                user.phone = update_data["phone_number"]
            if "email" in update_data:
                user.email = update_data["email"].lower()
            if "account_status" in update_data:
                user.is_active = (update_data["account_status"] == "active")
            if new_pw:
                pw_hash = hash_password(new_pw)
                user.hashed_password = pw_hash
                doctor.password_hash = pw_hash
    elif new_pw:
        doctor.password_hash = hash_password(new_pw)

    db.commit()
    db.refresh(doctor)

    log_audit_event(
        db=db,
        action="DOCTOR_UPDATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={"updated_fields": list(update_data.keys())},
        request=request
    )

    stu_cnt = db.query(func.count(Student.id)).filter(Student.doctor_id == doctor.id).scalar() or 0
    pat_cnt = db.query(func.count(Patient.id)).filter(Patient.doctor_id == doctor.id, Patient.is_deleted == False).scalar() or 0

    resp = DoctorResponse.model_validate(doctor)
    resp.students_count = stu_cnt
    resp.patients_count = pat_cnt
    return resp


@router.delete("/{doctor_id}", response_model=MessageResponse)
def delete_doctor(
    doctor_id: int,
    request: Request,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Admin-only: Deactivate doctor when appropriate."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {doctor_id} not found."}
        )

    doctor.account_status = "inactive"
    if doctor.user_id:
        user = db.query(User).filter(User.id == doctor.user_id).first()
        if user:
            user.is_active = False

    db.commit()

    log_audit_event(
        db=db,
        action="DOCTOR_DEACTIVATE",
        user=current_user,
        entity_name="Doctor",
        entity_id=str(doctor.id),
        details={"doctor_name": doctor.doctor_name},
        request=request
    )

    return MessageResponse(message=f"Doctor {doctor.doctor_name} has been deactivated.")
