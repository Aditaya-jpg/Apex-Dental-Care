from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.security.dependencies import get_current_user, require_roles
from app.security.hashing import hash_password

router = APIRouter(prefix="/students", tags=["Students Management"])


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def register_student(
    request: Request,
    payload: StudentCreate,
    current_user: User = Depends(require_roles("admin", "dentist", "doctor")),
    db: Session = Depends(get_db)
):
    """
    Register a new student.
    - If registered by a Doctor: automatically associates the student with that Doctor.
    - If registered by Admin: Doctor ID must be specified.
    - Students are strictly forbidden from registering other students.
    """
    # 1. Determine Doctor ID
    if current_user.role in ["dentist", "doctor"]:
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        if not doc and current_user.doctor_id:
            doc = db.query(Doctor).filter(Doctor.id == current_user.doctor_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DOCTOR_NOT_FOUND", "message": "Doctor record not found for logged-in user."}
            )
        assigned_doctor_id = doc.id
    else:
        # Admin registration
        if not payload.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DOCTOR_REQUIRED", "message": "Admin must specify the supervising doctor ID."}
            )
        doc = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "DOCTOR_NOT_FOUND", "message": f"Doctor with ID {payload.doctor_id} not found."}
            )
        assigned_doctor_id = doc.id

    # 2. Check duplicates
    if db.query(Student).filter(Student.email == payload.email.lower()).first() or \
       db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_EMAIL", "message": f"A user with email {payload.email} already exists."}
        )

    if db.query(Student).filter(Student.enrollment_number == payload.enrollment_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DUPLICATE_ENROLLMENT", "message": f"Enrollment number {payload.enrollment_number} already exists."}
        )

    pw_hash = hash_password(payload.password)
    username = payload.email.lower().split("@")[0]
    base_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}_{counter}"
        counter += 1

    # 3. Create User account
    user = User(
        email=payload.email.lower(),
        username=username,
        hashed_password=pw_hash,
        full_name=payload.student_name,
        role="student",
        phone=payload.phone_number,
        doctor_id=assigned_doctor_id,
        is_active=(payload.account_status == "active")
    )
    db.add(user)
    db.flush()

    # 4. Create Student entry
    student = Student(
        student_name=payload.student_name,
        email=payload.email.lower(),
        phone_number=payload.phone_number,
        college_institution=payload.college_institution,
        enrollment_number=payload.enrollment_number,
        doctor_id=assigned_doctor_id,
        password_hash=pw_hash,
        account_status=payload.account_status,
        user_id=user.id
    )
    db.add(student)
    db.flush()

    user.student_id = student.id

    db.commit()
    db.refresh(student)

    log_audit_event(
        db=db,
        action="STUDENT_CREATE",
        user=current_user,
        entity_name="Student",
        entity_id=str(student.id),
        details={"name": student.student_name, "email": student.email, "doctor_id": assigned_doctor_id},
        request=request
    )

    resp = StudentResponse.model_validate(student)
    resp.doctor_name = doc.doctor_name
    resp.patients_count = 0
    return resp


@router.get("", response_model=list[StudentResponse])
def list_students(
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List students.
    - Admin views all students.
    - Doctor views only students registered under them.
    - Student views only their own record.
    """
    query = db.query(Student)

    if current_user.role in ["dentist", "doctor"]:
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        c_doc_id = doc.id if doc else (current_user.doctor_id or 0)
        query = query.filter(Student.doctor_id == c_doc_id)
    elif current_user.role == "student":
        stu = db.query(Student).filter((Student.user_id == current_user.id) | (Student.email == current_user.email)).first()
        c_stu_id = stu.id if stu else (current_user.student_id or 0)
        query = query.filter(Student.id == c_stu_id)

    if search:
        st = f"%{search.strip()}%"
        query = query.filter(
            (Student.student_name.ilike(st)) |
            (Student.email.ilike(st)) |
            (Student.enrollment_number.ilike(st)) |
            (Student.college_institution.ilike(st))
        )

    students = query.order_by(Student.id.asc()).all()
    results = []
    for s in students:
        pat_cnt = db.query(func.count(Patient.id)).filter(Patient.student_id == s.id, Patient.is_deleted == False).scalar() or 0
        resp = StudentResponse.model_validate(s)
        resp.doctor_name = s.doctor.doctor_name if s.doctor else None
        resp.patients_count = pat_cnt
        results.append(resp)

    return results


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve details of a specific student with authorization checks."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."}
        )

    # Permission check: Doctor can only view their own students
    if current_user.role in ["dentist", "doctor"]:
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        c_doc_id = doc.id if doc else (current_user.doctor_id or 0)
        if student.doctor_id != c_doc_id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only view students registered under your supervision."}
            )
    elif current_user.role == "student":
        stu = db.query(Student).filter((Student.user_id == current_user.id) | (Student.email == current_user.email)).first()
        c_stu_id = stu.id if stu else (current_user.student_id or 0)
        if student.id != c_stu_id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only view your own student profile."}
            )

    pat_cnt = db.query(func.count(Patient.id)).filter(Patient.student_id == student.id, Patient.is_deleted == False).scalar() or 0
    resp = StudentResponse.model_validate(student)
    resp.doctor_name = student.doctor.doctor_name if student.doctor else None
    resp.patients_count = pat_cnt
    return resp


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    request: Request,
    current_user: User = Depends(require_roles("admin", "dentist", "doctor")),
    db: Session = Depends(get_db)
):
    """
    Doctor or Admin: Edit student information or activate/deactivate students.
    Doctors can only edit students registered under them.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."}
        )

    if current_user.role in ["dentist", "doctor"]:
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        c_doc_id = doc.id if doc else (current_user.doctor_id or 0)
        if student.doctor_id != c_doc_id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only manage students registered under your supervision."}
            )

    update_data = payload.model_dump(exclude_unset=True)
    new_pw = update_data.pop("password", None)

    for k, v in update_data.items():
        setattr(student, k, v)

    # Sync User account
    if student.user_id:
        user = db.query(User).filter(User.id == student.user_id).first()
        if user:
            if "student_name" in update_data:
                user.full_name = update_data["student_name"]
            if "phone_number" in update_data:
                user.phone = update_data["phone_number"]
            if "email" in update_data:
                user.email = update_data["email"].lower()
            if "account_status" in update_data:
                user.is_active = (update_data["account_status"] == "active")
            if new_pw:
                pw_hash = hash_password(new_pw)
                user.hashed_password = pw_hash
                student.password_hash = pw_hash
    elif new_pw:
        student.password_hash = hash_password(new_pw)

    db.commit()
    db.refresh(student)

    log_audit_event(
        db=db,
        action="STUDENT_UPDATE",
        user=current_user,
        entity_name="Student",
        entity_id=str(student.id),
        details={"updated_fields": list(update_data.keys())},
        request=request
    )

    pat_cnt = db.query(func.count(Patient.id)).filter(Patient.student_id == student.id, Patient.is_deleted == False).scalar() or 0
    resp = StudentResponse.model_validate(student)
    resp.doctor_name = student.doctor.doctor_name if student.doctor else None
    resp.patients_count = pat_cnt
    return resp


@router.delete("/{student_id}", response_model=MessageResponse)
def delete_student(
    student_id: int,
    request: Request,
    current_user: User = Depends(require_roles("admin", "dentist", "doctor")),
    db: Session = Depends(get_db)
):
    """
    Doctor or Admin: Deactivate/delete student when appropriate.
    Doctors can only delete students registered under them.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "STUDENT_NOT_FOUND", "message": f"Student with ID {student_id} not found."}
        )

    if current_user.role in ["dentist", "doctor"]:
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        c_doc_id = doc.id if doc else (current_user.doctor_id or 0)
        if student.doctor_id != c_doc_id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You can only manage students registered under your supervision."}
            )

    student.account_status = "inactive"
    if student.user_id:
        user = db.query(User).filter(User.id == student.user_id).first()
        if user:
            user.is_active = False

    db.commit()

    log_audit_event(
        db=db,
        action="STUDENT_DEACTIVATE",
        user=current_user,
        entity_name="Student",
        entity_id=str(student.id),
        details={"student_name": student.student_name},
        request=request
    )

    return MessageResponse(message=f"Student {student.student_name} has been deactivated.")
