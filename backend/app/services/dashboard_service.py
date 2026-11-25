from collections import Counter
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.care_log import CareAndSystemLog
from app.models.clinical_record import ClinicalRecord
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.student import Student
from app.models.user import User
from app.schemas.dashboard import (
    AdminDashboardResponse,
    DashboardAnalyticsResponse,
    DashboardSummaryResponse,
    DoctorDashboardResponse,
    DoctorPatientCount,
    PatientTrendPoint,
    ProcedureCount,
    RecentRegistrationItem,
    StatusCount,
    StudentDashboardResponse,
    StudentPatientCount,
)
from app.security.dependencies import resolve_doctor_for_user, resolve_student_for_user


class DashboardService:
    @staticmethod
    def _student_patient_ids(db: Session, current_user: User | None) -> list[int] | None:
        if not current_user or current_user.role != "student":
            return None
        stu = resolve_student_for_user(db, current_user)
        if not stu:
            return []
        rows = db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
        return [r[0] for r in rows]

    @classmethod
    def get_summary(
        cls,
        db: Session,
        period: str = "30d",
        current_user: User | None = None,
    ) -> DashboardSummaryResponse:
        today = date.today()
        if period == "today":
            period_start = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
        elif period == "7d":
            period_start = datetime.combine(today - timedelta(days=7), datetime.min.time(), tzinfo=UTC)
        else:
            period_start = datetime.combine(today - timedelta(days=30), datetime.min.time(), tzinfo=UTC)

        scoped_ids = cls._student_patient_ids(db, current_user)

        pat_q = db.query(func.count(Patient.id)).filter(Patient.is_deleted == False)
        new_pat_q = db.query(func.count(Patient.id)).filter(
            Patient.is_deleted == False,
            Patient.created_at >= period_start,
        )
        today_appt_q = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date == today,
            Appointment.status.notin_(["cancelled"]),
        )
        upcoming_appt_q = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date > today,
            Appointment.status.notin_(["cancelled", "completed"]),
        )
        tx_q = db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "treatment_plan")
        fu_q = db.query(func.count(CareAndSystemLog.id)).filter(
            CareAndSystemLog.event_type.in_(["followup", "recall"]),
            CareAndSystemLog.status == "pending",
            CareAndSystemLog.scheduled_date <= today,
        )

        if scoped_ids is not None:
            if not scoped_ids:
                return DashboardSummaryResponse(
                    total_patients=0,
                    new_patients_period=0,
                    today_appointments=0,
                    upcoming_appointments=0,
                    pending_treatments=0,
                    completed_treatments=0,
                    followups_due=0,
                )
            pat_q = pat_q.filter(Patient.id.in_(scoped_ids))
            new_pat_q = new_pat_q.filter(Patient.id.in_(scoped_ids))
            today_appt_q = today_appt_q.filter(Appointment.patient_id.in_(scoped_ids))
            upcoming_appt_q = upcoming_appt_q.filter(Appointment.patient_id.in_(scoped_ids))
            tx_q = tx_q.filter(ClinicalRecord.patient_id.in_(scoped_ids))
            fu_q = fu_q.filter(CareAndSystemLog.patient_id.in_(scoped_ids))

        pending_treatments = 0
        completed_treatments = 0
        for rec in tx_q.all():
            for item in (rec.payload_json or {}).get("items", []):
                st = item.get("status", "planned")
                if st in ("planned", "in_progress"):
                    pending_treatments += 1
                elif st == "completed":
                    completed_treatments += 1

        return DashboardSummaryResponse(
            total_patients=pat_q.scalar() or 0,
            new_patients_period=new_pat_q.scalar() or 0,
            today_appointments=today_appt_q.scalar() or 0,
            upcoming_appointments=upcoming_appt_q.scalar() or 0,
            pending_treatments=pending_treatments,
            completed_treatments=completed_treatments,
            followups_due=fu_q.scalar() or 0,
        )

    @classmethod
    def get_analytics(
        cls,
        db: Session,
        days: int = 30,
        current_user: User | None = None,
    ) -> DashboardAnalyticsResponse:
        today = date.today()
        scoped_ids = cls._student_patient_ids(db, current_user)

        appt_query = db.query(Appointment.status, func.count(Appointment.id))
        if scoped_ids is not None:
            appt_query = appt_query.filter(Appointment.patient_id.in_(scoped_ids)) if scoped_ids else appt_query.filter(Appointment.id == -1)
        appt_stats = appt_query.group_by(Appointment.status).all()
        appointments_by_status = [StatusCount(status=s, count=c) for s, c in appt_stats]

        tx_query = db.query(ClinicalRecord).filter(ClinicalRecord.record_type == "treatment_plan")
        if scoped_ids is not None:
            tx_query = tx_query.filter(ClinicalRecord.patient_id.in_(scoped_ids)) if scoped_ids else tx_query.filter(ClinicalRecord.id == -1)

        proc_counter: Counter[str] = Counter()
        for rec in tx_query.all():
            for item in (rec.payload_json or {}).get("items", []):
                proc = item.get("procedure_name")
                if proc:
                    proc_counter[proc] += 1
        treatments_by_procedure = [
            ProcedureCount(procedure_name=proc, count=cnt)
            for proc, cnt in proc_counter.most_common(8)
        ]

        patient_points = []
        for d in range(min(days, 14)):
            day_target = today - timedelta(days=min(days, 14) - 1 - d)
            next_day = day_target + timedelta(days=1)
            q = db.query(func.count(Patient.id)).filter(
                Patient.created_at >= datetime.combine(day_target, datetime.min.time(), tzinfo=UTC),
                Patient.created_at < datetime.combine(next_day, datetime.min.time(), tzinfo=UTC),
                Patient.is_deleted == False,
            )
            if scoped_ids is not None:
                q = q.filter(Patient.id.in_(scoped_ids)) if scoped_ids else q.filter(Patient.id == -1)
            count = q.scalar() or 0
            patient_points.append(PatientTrendPoint(date=day_target.strftime("%b %d"), new_patients=count))

        return DashboardAnalyticsResponse(
            appointments_by_status=appointments_by_status,
            treatments_by_procedure=treatments_by_procedure,
            patients_trend=patient_points,
        )

    @staticmethod
    def get_admin_dashboard(db: Session) -> AdminDashboardResponse:
        """Admin dashboard: clinic-wide doctors, students, patients, and recent registrations."""
        total_doctors = db.query(func.count(Doctor.id)).filter(Doctor.is_active == True).scalar() or 0
        total_students = (
            db.query(func.count(Student.id))
            .filter(Student.is_active == True, Student.revoked_at.is_(None))
            .scalar()
            or 0
        )
        total_patients = db.query(func.count(Patient.id)).filter(Patient.is_deleted == False).scalar() or 0

        doctors = db.query(Doctor).filter(Doctor.is_active == True).order_by(Doctor.id.asc()).all()
        doc_counts = []
        for d in doctors:
            stu_cnt = (
                db.query(func.count(Student.id))
                .filter(Student.doctor_id == d.id, Student.is_active == True, Student.revoked_at.is_(None))
                .scalar()
                or 0
            )
            pat_cnt = (
                db.query(func.count(Patient.id))
                .filter(Patient.doctor_id == d.id, Patient.is_deleted == False)
                .scalar()
                or 0
            )
            doc_counts.append(
                DoctorPatientCount(
                    doctor_id=d.id,
                    doctor_name=d.full_name,
                    specialization=d.specialization,
                    department=d.department,
                    cabin_operatory=d.cabin_operatory,
                    is_admin=d.is_admin,
                    students_count=stu_cnt,
                    patient_count=pat_cnt,
                )
            )

        students = (
            db.query(Student)
            .filter(Student.is_active == True, Student.revoked_at.is_(None))
            .order_by(Student.id.asc())
            .all()
        )
        stu_counts = []
        for s in students:
            pat_cnt = (
                db.query(func.count(Patient.id))
                .filter(Patient.student_id == s.id, Patient.is_deleted == False)
                .scalar()
                or 0
            )
            stu_counts.append(
                StudentPatientCount(
                    student_id=s.id,
                    student_name=s.full_name,
                    doctor_name=s.doctor.full_name if s.doctor else "PGI Branch Pool",
                    roll_number=s.roll_number,
                    enrollment_number=s.roll_number,
                    patient_count=pat_cnt,
                )
            )

        recent_items: list[RecentRegistrationItem] = []
        for d in db.query(Doctor).order_by(desc(Doctor.created_at)).limit(5).all():
            recent_items.append(
                RecentRegistrationItem(
                    entity_type="Doctor",
                    id=d.id,
                    name=d.full_name,
                    code_or_email=d.email,
                    created_at=d.created_at.strftime("%d %b %Y, %H:%M"),
                )
            )
        for s in db.query(Student).filter(Student.is_active == True).order_by(desc(Student.created_at)).limit(5).all():
            recent_items.append(
                RecentRegistrationItem(
                    entity_type="Student",
                    id=s.id,
                    name=s.full_name,
                    code_or_email=s.roll_number,
                    created_at=s.created_at.strftime("%d %b %Y, %H:%M"),
                )
            )
        for p in db.query(Patient).filter(Patient.is_deleted == False).order_by(desc(Patient.created_at)).limit(5).all():
            recent_items.append(
                RecentRegistrationItem(
                    entity_type="Patient",
                    id=p.id,
                    name=p.full_name,
                    code_or_email=p.cr_number or p.patient_code,
                    created_at=p.created_at.strftime("%d %b %Y, %H:%M"),
                )
            )

        return AdminDashboardResponse(
            total_doctors=total_doctors,
            total_students=total_students,
            total_patients=total_patients,
            doctor_patient_counts=doc_counts,
            student_patient_counts=stu_counts,
            recent_registrations=recent_items,
        )

    @staticmethod
    def get_doctor_dashboard(db: Session, current_user: User) -> DoctorDashboardResponse:
        """
        Doctor dashboard: branch-wide patient visibility, flexible student pool,
        missed appointments widget, and high-severity pain triage widget.
        """
        doc = resolve_doctor_for_user(db, current_user)
        doc_id = doc.id if doc else 0
        doc_name = doc.full_name if doc else current_user.full_name

        # Flexible student pool across the branch
        active_students = (
            db.query(Student)
            .filter(Student.is_active == True, Student.revoked_at.is_(None))
            .order_by(Student.id.asc())
            .all()
        )
        total_students = len(active_students)

        all_patients_count = db.query(func.count(Patient.id)).filter(Patient.is_deleted == False).scalar() or 0
        my_patients_count = (
            db.query(func.count(Patient.id))
            .filter(Patient.doctor_id == doc_id, Patient.is_deleted == False)
            .scalar()
            or 0
        )
        patients_registered_directly = (
            db.query(func.count(Patient.id))
            .filter(Patient.student_id.is_(None), Patient.is_deleted == False)
            .scalar()
            or 0
        )
        patients_assigned_to_students = (
            db.query(func.count(Patient.id))
            .filter(Patient.student_id.is_not(None), Patient.is_deleted == False)
            .scalar()
            or 0
        )

        student_list = []
        for s in active_students:
            assigned_pts = (
                db.query(func.count(Patient.id))
                .filter(Patient.student_id == s.id, Patient.is_deleted == False)
                .scalar()
                or 0
            )
            student_list.append({
                "id": s.id,
                "student_name": s.full_name,
                "name": s.full_name,
                "email": s.email,
                "phone": s.phone,
                "roll_number": s.roll_number,
                "enrollment_number": s.roll_number,
                "college_institution": s.college_institution,
                "year_of_study": s.year_of_study,
                "department": s.department,
                "patient_count": assigned_pts,
            })

        recent_pats = (
            db.query(Patient)
            .filter(Patient.is_deleted == False)
            .order_by(desc(Patient.created_at))
            .limit(10)
            .all()
        )
        recent_pat_list = [
            {
                "id": p.id,
                "patient_code": p.patient_code,
                "cr_number": p.cr_number,
                "patient_name": p.full_name,
                "name": p.full_name,
                "phone": p.phone,
                "gender": p.gender,
                "pain_scale": p.pain_scale,
                "severity_level": p.severity_level,
                "student_name": p.student.full_name if p.student else None,
                "doctor_name": p.doctor.full_name if p.doctor else None,
                "created_at": p.created_at.strftime("%d %b %Y"),
            }
            for p in recent_pats
        ]

        today = date.today()
        pending_fus = (
            db.query(CareAndSystemLog)
            .filter(
                CareAndSystemLog.event_type.in_(["followup", "recall"]),
                CareAndSystemLog.status == "pending",
            )
            .order_by(CareAndSystemLog.scheduled_date.asc())
            .limit(20)
            .all()
        )
        fu_list = [
            {
                "id": fu.id,
                "patient_id": fu.patient_id,
                "patient_name": fu.patient.full_name if fu.patient else "Patient",
                "cr_number": fu.patient.cr_number if fu.patient else None,
                "scheduled_date": fu.scheduled_date.strftime("%d %b %Y") if fu.scheduled_date else "",
                "reason": fu.title or (fu.payload_json or {}).get("reason", "Follow-up"),
                "is_overdue": bool(fu.scheduled_date and fu.scheduled_date < today),
            }
            for fu in pending_fus
        ]

        # Missed appointments widget
        missed_appts = (
            db.query(Appointment)
            .filter((Appointment.is_missed == True) | (Appointment.status == "no_show"))
            .order_by(desc(Appointment.appointment_date), desc(Appointment.id))
            .limit(15)
            .all()
        )
        missed_list = [
            {
                "id": a.id,
                "patient_id": a.patient_id,
                "patient_name": a.patient.full_name if a.patient else "",
                "cr_number": a.patient.cr_number if a.patient else None,
                "phone": a.patient.phone if a.patient else None,
                "appointment_date": a.appointment_date.isoformat(),
                "start_time": str(a.start_time)[:5],
                "operatory": a.operatory,
                "doctor_name": a.doctor.full_name if a.doctor else None,
                "missed_reason": a.missed_reason or a.reason or "Missed appointment",
                "status": a.status,
            }
            for a in missed_appts
        ]

        # High-severity pain / triage patients widget
        high_sev_pats = (
            db.query(Patient)
            .filter(
                Patient.is_deleted == False,
                (Patient.pain_scale >= 6) | (Patient.severity_level.in_(["severe", "critical"])),
            )
            .order_by(desc(Patient.pain_scale), desc(Patient.updated_at))
            .limit(15)
            .all()
        )
        high_sev_list = [
            {
                "id": p.id,
                "patient_code": p.patient_code,
                "cr_number": p.cr_number,
                "patient_name": p.full_name,
                "pain_scale": p.pain_scale,
                "severity_level": p.severity_level,
                "disease_categories": p.disease_categories or [],
                "student_name": p.student.full_name if p.student else None,
                "doctor_name": p.doctor.full_name if p.doctor else None,
            }
            for p in high_sev_pats
        ]

        return DoctorDashboardResponse(
            doctor_id=doc_id,
            doctor_name=doc_name,
            total_students=total_students,
            total_patients=all_patients_count,
            all_patients_count=all_patients_count,
            my_patients_count=my_patients_count,
            patients_registered_directly=patients_registered_directly,
            patients_assigned_to_students=patients_assigned_to_students,
            pending_followups=len(fu_list),
            students=student_list,
            recent_patients=recent_pat_list,
            pending_followups_list=fu_list,
            missed_appointments=missed_list,
            high_severity_patients=high_sev_list,
        )

    @staticmethod
    def get_student_dashboard(db: Session, current_user: User) -> StudentDashboardResponse:
        """Student dashboard: strictly isolated to patients assigned to current_student.id."""
        stu = resolve_student_for_user(db, current_user)
        stu_id = stu.id if stu else 0
        stu_name = stu.full_name if stu else current_user.full_name
        doc_name = stu.doctor.full_name if (stu and stu.doctor) else "PGI Branch Pool"

        assigned_pts = (
            db.query(Patient)
            .filter(Patient.student_id == stu_id, Patient.is_deleted == False)
            .order_by(desc(Patient.created_at))
            .all()
        )

        pat_list = [
            {
                "id": p.id,
                "patient_code": p.patient_code,
                "cr_number": p.cr_number,
                "patient_name": p.full_name,
                "name": p.full_name,
                "doctor_name": p.doctor.full_name if p.doctor else "PGI Dental Faculty",
                "phone": p.phone,
                "gender": p.gender,
                "pain_scale": p.pain_scale,
                "severity_level": p.severity_level,
                "disease_categories": p.disease_categories or [],
                "created_at": p.created_at.strftime("%d %b %Y"),
            }
            for p in assigned_pts
        ]

        patient_ids = [p.id for p in assigned_pts]
        pending_records_cnt = 0
        upcoming_appts_list: list[dict] = []

        if patient_ids:
            tx_plans = (
                db.query(ClinicalRecord)
                .filter(
                    ClinicalRecord.record_type == "treatment_plan",
                    ClinicalRecord.patient_id.in_(patient_ids),
                )
                .all()
            )
            for plan in tx_plans:
                for item in (plan.payload_json or {}).get("items", []):
                    if item.get("status", "planned") in ("planned", "in_progress"):
                        pending_records_cnt += 1

            today = date.today()
            appts = (
                db.query(Appointment)
                .filter(
                    Appointment.patient_id.in_(patient_ids),
                    Appointment.appointment_date >= today,
                    Appointment.status.notin_(["cancelled", "completed"]),
                )
                .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
                .limit(10)
                .all()
            )
            for a in appts:
                upcoming_appts_list.append({
                    "id": a.id,
                    "patient_id": a.patient_id,
                    "patient_name": a.patient.full_name if a.patient else "",
                    "cr_number": a.patient.cr_number if a.patient else None,
                    "date": a.appointment_date.strftime("%d %b %Y"),
                    "time": f"{str(a.start_time)[:5]} - {str(a.end_time)[:5]}",
                    "operatory": a.operatory,
                    "reason": a.reason or a.appointment_type,
                    "status": a.status,
                })

        return StudentDashboardResponse(
            student_id=stu_id,
            student_name=stu_name,
            doctor_name=doc_name,
            my_patients_count=len(assigned_pts),
            pending_records=pending_records_cnt,
            upcoming_appointments=len(upcoming_appts_list),
            my_patients=pat_list,
            recent_patients=pat_list[:10],
            upcoming_appointments_list=upcoming_appts_list,
        )
