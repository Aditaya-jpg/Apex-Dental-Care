from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.appointment import Appointment
from app.models.care_log import CareAndSystemLog
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.security.dependencies import require_roles, resolve_student_for_user
from app.security.hashing import hash_password

router = APIRouter(prefix="/students", tags=["Students Management"])


def _build_student_response(db: Session, student: Student) -> StudentResponse:
    pat_cnt = (
        db.query(func.count(Patient.id))
        .filter(Patient.student_id == student.id, Patient.is_deleted == False)
        .scalar()
        or 0
    )
    resp = StudentResponse.model_validate(student)
    resp.doctor_name = student.doctor.full_name if student.doctor else None
    resp.patients_count = pat_cnt
    return resp


def _revoke_student_and_unassign(
    db: Session,
    student: Student,
    current_user: User,
    request: Request | None,
    *,
    hard_delete: bool,
) -> dict[str, str | int]:
    """
    Unassign all patients safely (Patient.student_id = None),
    immediately revoke linked User JWT/refresh tokens, and either delete or mark student revoked.
    """
    now = datetime.now(UTC)
    student_id = student.id
    student_name = student.full_name
    student_email = student.email

    # 1. Preserve patient records by clearing student assignment
    unassigned_count = (
        db.query(Patient)
        .filter(Patient.student_id == student_id)
        .update({"student_id": None}, synchronize_session=False)
    )
    db.query(Appointment).filter(Appointment.student_id == student_id).update(
        {"student_id": None}, synchronize_session=False
    )
    db.query(ClinicalRecord).filter(ClinicalRecord.student_id == student_id).update(
        {"student_id": None}, synchronize_session=False
    )
    db.query(CareAndSystemLog).filter(CareAndSystemLog.assigned_student_id == student_id).update(
        {"assigned_student_id": None}, synchronize_session=False
    )

    # 2. Immediately revoke User session & prevent login/refresh
    if student.user_id:
        user = db.query(User).filter(User.id == student.user_id).first()
        if user:
            user.is_active = False
            user.token_version += 1
            user.refresh_tokens_json = []
            user.revoked_at = now

    # 3. Delete or soft-revoke Student row
    if hard_delete:
        db.delete(student)
        action = "STUDENT_DELETE"
    else:
        student.is_active = False
        student.revoked_at = now
        action = "STUDENT_REVOKE"

    db.commit()

    log_audit_event(
        db=db,
        action=action,
        user=current_user,
        entity_name="Student",
        entity_id=str(student_id),
        details={
            "student_name": student_name,
            "email": student_email,
            "unassigned_patients": unassigned_count,
            "hard_delete": hard_delete,
        },
        request=request,
    )

    return {
        "student_id": student_id,
        "student_name": student_name,
        "email": student_email,
        "unassigned_patients": unassigned_count,
    }


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def register_student(
    request: Request,
    payload: StudentCreate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """
    Admin or Doctor: Register a new student in the single branch-wide students table.
    doctor_id is OPTIONAL/nullable so students can work flexibly across doctors.
    """
    assigned_doctor_id = payload.doctor_id
    doc: Doctor | None = None
    if assigned_doctor_id is not None:
        doc = db.query(Doctor).filter(Doctor.id == assigned_doctor_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {assigned_doctor_id} not found."},
            )

    email_lower = payload.email.lower()
    if (
        db.query(Student).filter(Student.email == email_lower).first()
        or db.query(User).filter(User.email == email_lower).first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_EMAIL", "message": f"A user with email {payload.email} already exists."},
        )

    if db.query(Student).filter(Student.roll_number == payload.roll_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "DUPLICATE_ENROLLMENT",
                "message": f"Roll/Enrollment number {payload.roll_number} already exists.",
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
        role="student",
        phone=payload.phone,
        is_active=is_active,
        token_version=1,
        refresh_tokens_json=[],
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        doctor_id=assigned_doctor_id,
        full_name=payload.full_name,
        email=email_lower,
        phone=payload.phone,
        roll_number=payload.roll_number,
        year_of_study=payload.year_of_study,
        department=payload.department,
        college_institution=payload.college_institution,
        is_active=is_active,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    log_audit_event(
        db=db,
        action="STUDENT_CREATE",
        user=current_user,
        entity_name="Student",
        entity_id=str(student.id),
        details={"name": student.full_name, "email": student.email, "doctor_id": assigned_doctor_id},
        request=request,
    )

    return _build_student_response(db, student)



@router.get("/{student_id}/workspace")
def get_student_workspace(
    student_id: int,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """
    Doctor / Admin: View any student's assigned patients, clinical progress, and recent activity.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    patients = (
        db.query(Patient)
        .filter(Patient.student_id == student.id, Patient.is_deleted == False)
        .order_by(Patient.id.asc())
        .all()
    )

    patient_ids = [p.id for p in patients]
    records = (
        db.query(ClinicalRecord)
        .filter(
            or_(
                ClinicalRecord.student_id == student.id,
                ClinicalRecord.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(ClinicalRecord.record_date.desc(), ClinicalRecord.id.desc())
        .all()
    )

    appts = (
        db.query(Appointment)
        .filter(
            or_(
                Appointment.student_id == student.id,
                Appointment.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
        .all()
    )

    today = datetime.now(UTC).date()
    patient_map = {p.id: p for p in patients}

    patient_rows = []
    for p in patients:
        p_visits = [r for r in records if r.patient_id == p.id and r.record_type == "visit"]
        p_plans = [r for r in records if r.patient_id == p.id and r.record_type == "treatment_plan"]
        p_surgeries = [r for r in records if r.patient_id == p.id and r.record_type == "surgical_log"]
        p_upcoming = [
            a for a in appts
            if a.patient_id == p.id and a.appointment_date >= today and a.status not in ("cancelled", "completed")
        ]
        last_visit = p_visits[0] if p_visits else None
        last_payload = (last_visit.payload_json or {}) if last_visit else {}
        latest_plan = p_plans[0] if p_plans else None

        patient_rows.append({
            "id": p.id,
            "cr_number": p.cr_number,
            "patient_code": p.patient_code,
            "full_name": p.full_name,
            "age": p.age,
            "gender": p.gender,
            "phone": p.phone,
            "severity_level": p.severity_level or "none",
            "pain_scale": p.pain_scale or 0,
            "tracker_stage": p.tracker_stage or "registered",
            "disease_categories": p.disease_categories or [],
            "attending_doctor": p.doctor.full_name if p.doctor else None,
            "visits_count": len(p_visits),
            "treatment_plans_count": len(p_plans),
            "surgical_logs_count": len(p_surgeries),
            "latest_plan_status": latest_plan.status if latest_plan else None,
            "last_visit_date": last_visit.record_date.isoformat() if last_visit else None,
            "last_visit_diagnosis": last_payload.get("diagnosis") or (last_visit.title if last_visit else None),
            "next_appointment_date": p_upcoming[0].appointment_date.isoformat() if p_upcoming else None,
        })

    student_records = [r for r in records if r.student_id == student.id or r.patient_id in patient_map]
    recent_activity = []
    for r in student_records[:12]:
        pat = patient_map.get(r.patient_id)
        recent_activity.append({
            "id": r.id,
            "record_type": r.record_type,
            "record_date": r.record_date.isoformat() if r.record_date else None,
            "title": r.title or r.record_type.replace("_", " ").title(),
            "status": r.status,
            "patient_id": r.patient_id,
            "patient_name": pat.full_name if pat else (r.patient.full_name if r.patient else "Patient"),
            "cr_number": pat.cr_number if pat else None,
        })

    upcoming_count = sum(
        1 for a in appts if a.appointment_date >= today and a.status not in ("cancelled", "completed")
    )
    missed_count = sum(1 for a in appts if a.is_missed or a.attendance_status == "missed")

    return {
        "student": _build_student_response(db, student).model_dump(mode="json"),
        "summary": {
            "assigned_patients": len(patients),
            "visits_recorded": sum(1 for r in student_records if r.record_type == "visit"),
            "treatment_plans": sum(1 for r in student_records if r.record_type == "treatment_plan"),
            "surgical_logs": sum(1 for r in student_records if r.record_type == "surgical_log"),
            "prescriptions": sum(1 for r in student_records if r.record_type == "prescription"),
            "upcoming_appointments": upcoming_count,
            "missed_appointments": missed_count,
        },
        "patients": patient_rows,
        "recent_activity": recent_activity,
    }


@router.get("", response_model=list[StudentResponse])
def list_students(
    search: str | None = None,
    doctor_id: int | None = None,
    include_inactive: bool = False,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """
    List students:
    - Admin & Doctor view all active students across the PGI branch (optional doctor_id filter).
    - Student views only their own profile.
    - Patient & Receptionist are blocked (403).
    """
    query = db.query(Student)

    is_admin_actor = current_user.role == "admin" or current_user.is_admin
    if current_user.role == "student":
        stu = resolve_student_for_user(db, current_user)
        query = query.filter(Student.id == (stu.id if stu else 0))
    else:
        if not (is_admin_actor and include_inactive):
            query = query.filter(Student.is_active == True, Student.revoked_at.is_(None))
        if doctor_id is not None:
            query = query.filter(Student.doctor_id == doctor_id)

    if search:
        st = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.full_name.ilike(st),
                Student.email.ilike(st),
                Student.roll_number.ilike(st),
                Student.college_institution.ilike(st),
                Student.department.ilike(st),
            )
        )

    students = query.order_by(Student.id.asc()).all()
    return [_build_student_response(db, s) for s in students]


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve student details. Students can only view their own profile."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    if current_user.role == "student":
        own = resolve_student_for_user(db, current_user)
        if not own or student.id != own.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only view your own student profile."},
            )

    return _build_student_response(db, student)


@router.get("/{student_id}/workspace")
def get_student_workspace(
    student_id: int,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """
    Doctor / Admin: View any student's assigned patients, clinical progress, and recent activity.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    patients = (
        db.query(Patient)
        .filter(Patient.student_id == student.id, Patient.is_deleted == False)
        .order_by(Patient.id.asc())
        .all()
    )

    patient_ids = [p.id for p in patients]
    records = (
        db.query(ClinicalRecord)
        .filter(
            or_(
                ClinicalRecord.student_id == student.id,
                ClinicalRecord.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(ClinicalRecord.record_date.desc(), ClinicalRecord.id.desc())
        .all()
    )

    appts = (
        db.query(Appointment)
        .filter(
            or_(
                Appointment.student_id == student.id,
                Appointment.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
        .all()
    )

    today = datetime.now(UTC).date()
    patient_map = {p.id: p for p in patients}

    patient_rows = []
    for p in patients:
        p_visits = [r for r in records if r.patient_id == p.id and r.record_type == "visit"]
        p_plans = [r for r in records if r.patient_id == p.id and r.record_type == "treatment_plan"]
        p_surgeries = [r for r in records if r.patient_id == p.id and r.record_type == "surgical_log"]
        p_upcoming = [
            a for a in appts
            if a.patient_id == p.id and a.appointment_date >= today and a.status not in ("cancelled", "completed")
        ]
        last_visit = p_visits[0] if p_visits else None
        last_payload = (last_visit.payload_json or {}) if last_visit else {}
        latest_plan = p_plans[0] if p_plans else None

        patient_rows.append({
            "id": p.id,
            "cr_number": p.cr_number,
            "patient_code": p.patient_code,
            "full_name": p.full_name,
            "age": p.age,
            "gender": p.gender,
            "phone": p.phone,
            "severity_level": p.severity_level or "none",
            "pain_scale": p.pain_scale or 0,
            "tracker_stage": p.tracker_stage or "registered",
            "disease_categories": p.disease_categories or [],
            "attending_doctor": p.doctor.full_name if p.doctor else None,
            "visits_count": len(p_visits),
            "treatment_plans_count": len(p_plans),
            "surgical_logs_count": len(p_surgeries),
            "latest_plan_status": latest_plan.status if latest_plan else None,
            "last_visit_date": last_visit.record_date.isoformat() if last_visit else None,
            "last_visit_diagnosis": last_payload.get("diagnosis") or (last_visit.title if last_visit else None),
            "next_appointment_date": p_upcoming[0].appointment_date.isoformat() if p_upcoming else None,
        })

    student_records = [r for r in records if r.student_id == student.id or r.patient_id in patient_map]
    recent_activity = []
    for r in student_records[:12]:
        pat = patient_map.get(r.patient_id)
        recent_activity.append({
            "id": r.id,
            "record_type": r.record_type,
            "record_date": r.record_date.isoformat() if r.record_date else None,
            "title": r.title or r.record_type.replace("_", " ").title(),
            "status": r.status,
            "patient_id": r.patient_id,
            "patient_name": pat.full_name if pat else (r.patient.full_name if r.patient else "Patient"),
            "cr_number": pat.cr_number if pat else None,
        })

    upcoming_count = sum(
        1 for a in appts if a.appointment_date >= today and a.status not in ("cancelled", "completed")
    )
    missed_count = sum(1 for a in appts if a.is_missed or a.attendance_status == "missed")

    return {
        "student": _build_student_response(db, student).model_dump(mode="json"),
        "summary": {
            "assigned_patients": len(patients),
            "visits_recorded": sum(1 for r in student_records if r.record_type == "visit"),
            "treatment_plans": sum(1 for r in student_records if r.record_type == "treatment_plan"),
            "surgical_logs": sum(1 for r in student_records if r.record_type == "surgical_log"),
            "prescriptions": sum(1 for r in student_records if r.record_type == "prescription"),
            "upcoming_appointments": upcoming_count,
            "missed_appointments": missed_count,
        },
        "patients": patient_rows,
        "recent_activity": recent_activity,
    }


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Admin or Doctor: Edit student profile or optional supervising doctor assignment."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    raw_data = payload.model_dump(exclude_unset=True)
    new_pw = raw_data.pop("password", None)

    if "student_name" in raw_data and "full_name" not in raw_data:
        raw_data["full_name"] = raw_data.pop("student_name")
    else:
        raw_data.pop("student_name", None)

    if "phone_number" in raw_data and "phone" not in raw_data:
        raw_data["phone"] = raw_data.pop("phone_number")
    else:
        raw_data.pop("phone_number", None)

    if "enrollment_number" in raw_data and "roll_number" not in raw_data:
        raw_data["roll_number"] = raw_data.pop("enrollment_number")
    else:
        raw_data.pop("enrollment_number", None)

    if "account_status" in raw_data and "is_active" not in raw_data:
        raw_data["is_active"] = raw_data.pop("account_status") == "active"
    else:
        raw_data.pop("account_status", None)

    if "email" in raw_data and raw_data["email"]:
        raw_data["email"] = raw_data["email"].lower()

    if "doctor_id" in raw_data and raw_data["doctor_id"] is not None:
        doc = db.query(Doctor).filter(Doctor.id == raw_data["doctor_id"]).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {raw_data['doctor_id']} not found."},
            )

    for k, v in raw_data.items():
        if hasattr(student, k):
            setattr(student, k, v)

    if student.user_id:
        user = db.query(User).filter(User.id == student.user_id).first()
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
                    student.revoked_at = datetime.now(UTC)
                elif new_active:
                    user.revoked_at = None
                    student.revoked_at = None
                user.is_active = new_active
            if new_pw:
                user.password_hash = hash_password(new_pw)

    db.commit()
    db.refresh(student)

    log_audit_event(
        db=db,
        action="STUDENT_UPDATE",
        user=current_user,
        entity_name="Student",
        entity_id=str(student.id),
        details={"updated_fields": list(raw_data.keys())},
        request=request,
    )

    return _build_student_response(db, student)



@router.get("/{student_id}/workspace")
def get_student_workspace(
    student_id: int,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """
    Doctor / Admin: View any student's assigned patients, clinical progress, and recent activity.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    patients = (
        db.query(Patient)
        .filter(Patient.student_id == student.id, Patient.is_deleted == False)
        .order_by(Patient.id.asc())
        .all()
    )

    patient_ids = [p.id for p in patients]
    records = (
        db.query(ClinicalRecord)
        .filter(
            or_(
                ClinicalRecord.student_id == student.id,
                ClinicalRecord.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(ClinicalRecord.record_date.desc(), ClinicalRecord.id.desc())
        .all()
    )

    appts = (
        db.query(Appointment)
        .filter(
            or_(
                Appointment.student_id == student.id,
                Appointment.patient_id.in_(patient_ids) if patient_ids else False,
            )
        )
        .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
        .all()
    )

    today = datetime.now(UTC).date()
    patient_map = {p.id: p for p in patients}

    patient_rows = []
    for p in patients:
        p_visits = [r for r in records if r.patient_id == p.id and r.record_type == "visit"]
        p_plans = [r for r in records if r.patient_id == p.id and r.record_type == "treatment_plan"]
        p_surgeries = [r for r in records if r.patient_id == p.id and r.record_type == "surgical_log"]
        p_upcoming = [
            a for a in appts
            if a.patient_id == p.id and a.appointment_date >= today and a.status not in ("cancelled", "completed")
        ]
        last_visit = p_visits[0] if p_visits else None
        last_payload = (last_visit.payload_json or {}) if last_visit else {}
        latest_plan = p_plans[0] if p_plans else None

        patient_rows.append({
            "id": p.id,
            "cr_number": p.cr_number,
            "patient_code": p.patient_code,
            "full_name": p.full_name,
            "age": p.age,
            "gender": p.gender,
            "phone": p.phone,
            "severity_level": p.severity_level or "none",
            "pain_scale": p.pain_scale or 0,
            "tracker_stage": p.tracker_stage or "registered",
            "disease_categories": p.disease_categories or [],
            "attending_doctor": p.doctor.full_name if p.doctor else None,
            "visits_count": len(p_visits),
            "treatment_plans_count": len(p_plans),
            "surgical_logs_count": len(p_surgeries),
            "latest_plan_status": latest_plan.status if latest_plan else None,
            "last_visit_date": last_visit.record_date.isoformat() if last_visit else None,
            "last_visit_diagnosis": last_payload.get("diagnosis") or (last_visit.title if last_visit else None),
            "next_appointment_date": p_upcoming[0].appointment_date.isoformat() if p_upcoming else None,
        })

    student_records = [r for r in records if r.student_id == student.id or r.patient_id in patient_map]
    recent_activity = []
    for r in student_records[:12]:
        pat = patient_map.get(r.patient_id)
        recent_activity.append({
            "id": r.id,
            "record_type": r.record_type,
            "record_date": r.record_date.isoformat() if r.record_date else None,
            "title": r.title or r.record_type.replace("_", " ").title(),
            "status": r.status,
            "patient_id": r.patient_id,
            "patient_name": pat.full_name if pat else (r.patient.full_name if r.patient else "Patient"),
            "cr_number": pat.cr_number if pat else None,
        })

    upcoming_count = sum(
        1 for a in appts if a.appointment_date >= today and a.status not in ("cancelled", "completed")
    )
    missed_count = sum(1 for a in appts if a.is_missed or a.attendance_status == "missed")

    return {
        "student": _build_student_response(db, student).model_dump(mode="json"),
        "summary": {
            "assigned_patients": len(patients),
            "visits_recorded": sum(1 for r in student_records if r.record_type == "visit"),
            "treatment_plans": sum(1 for r in student_records if r.record_type == "treatment_plan"),
            "surgical_logs": sum(1 for r in student_records if r.record_type == "surgical_log"),
            "prescriptions": sum(1 for r in student_records if r.record_type == "prescription"),
            "upcoming_appointments": upcoming_count,
            "missed_appointments": missed_count,
        },
        "patients": patient_rows,
        "recent_activity": recent_activity,
    }


@router.post("/{student_id}/revoke", response_model=MessageResponse)
def revoke_student(
    student_id: int,
    request: Request,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Immediately revoke a student's access, invalidate JWTs, and unassign their patients safely."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    info = _revoke_student_and_unassign(db, student, current_user, request, hard_delete=False)
    return MessageResponse(
        message=f"Student {info['student_name']} access revoked immediately ({info['unassigned_patients']} patient assignments cleared)."
    )


@router.delete("/by-email/{email}", response_model=MessageResponse)
def delete_student_by_email(
    email: str,
    request: Request,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Remove a student by email, immediately revoking all JWT sessions and preserving patient records."""
    student = db.query(Student).filter(Student.email == email.strip().lower()).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with email '{email}' not found."},
        )

    info = _revoke_student_and_unassign(db, student, current_user, request, hard_delete=True)
    return MessageResponse(
        message=f"Student {info['student_name']} ({info['email']}) removed and access revoked immediately."
    )


@router.delete("/{student_id}", response_model=MessageResponse)
def delete_student(
    student_id: int,
    request: Request,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Remove a student by ID, immediately revoking all JWT sessions and preserving patient records."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."},
        )

    info = _revoke_student_and_unassign(db, student, current_user, request, hard_delete=True)
    return MessageResponse(
        message=f"Student {info['student_name']} removed and access revoked immediately."
    )
