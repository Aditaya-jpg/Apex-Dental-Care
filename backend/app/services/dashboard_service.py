from datetime import date, datetime, timedelta, UTC
from decimal import Decimal

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.followup import FollowUp
from app.models.patient import Patient
from app.models.student import Student
from app.models.treatment import TreatmentItem
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
    RevenueTrendPoint,
    StatusCount,
    StudentDashboardResponse,
    StudentPatientCount,
)


class DashboardService:
    @staticmethod
    def get_summary(db: Session, period: str = "30d") -> DashboardSummaryResponse:
        today = date.today()

        # Period start
        if period == "today":
            period_start = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
        elif period == "7d":
            period_start = datetime.combine(today - timedelta(days=7), datetime.min.time(), tzinfo=UTC)
        else: # default 30d
            period_start = datetime.combine(today - timedelta(days=30), datetime.min.time(), tzinfo=UTC)

        # Total active patients
        total_patients = db.query(func.count(Patient.id)).filter(Patient.is_deleted == False).scalar() or 0

        # New patients in period
        new_patients = db.query(func.count(Patient.id)).filter(
            Patient.is_deleted == False,
            Patient.created_at >= period_start
        ).scalar() or 0

        # Today's appointments
        today_appts = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date == today,
            Appointment.status.notin_(["cancelled"])
        ).scalar() or 0

        # Upcoming appointments (future days)
        upcoming_appts = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date > today,
            Appointment.status.notin_(["cancelled", "completed"])
        ).scalar() or 0

        # Pending treatments
        pending_treatments = db.query(func.count(TreatmentItem.id)).filter(
            TreatmentItem.status.in_(["planned", "in_progress"])
        ).scalar() or 0

        # Completed treatments
        completed_treatments = db.query(func.count(TreatmentItem.id)).filter(
            TreatmentItem.status == "completed"
        ).scalar() or 0

        # Follow-ups due (pending up to today)
        followups_due = db.query(func.count(FollowUp.id)).filter(
            FollowUp.status == "pending",
            FollowUp.scheduled_date <= today
        ).scalar() or 0

        return DashboardSummaryResponse(
            total_patients=total_patients,
            new_patients_period=new_patients,
            today_appointments=today_appts,
            upcoming_appointments=upcoming_appts,
            pending_treatments=pending_treatments,
            completed_treatments=completed_treatments,
            total_revenue=Decimal('0.00'),
            outstanding_payments=Decimal('0.00'),
            followups_due=followups_due
        )

    @staticmethod
    def get_analytics(db: Session, days: int = 30) -> DashboardAnalyticsResponse:
        today = date.today()

        # 1. Appointments by status
        appt_stats = db.query(
            Appointment.status,
            func.count(Appointment.id)
        ).group_by(Appointment.status).all()

        appointments_by_status = [
            StatusCount(status=status_name, count=count) for status_name, count in appt_stats
        ]

        # 2. Treatments by procedure
        treatment_stats = db.query(
            TreatmentItem.procedure_name,
            func.count(TreatmentItem.id)
        ).group_by(TreatmentItem.procedure_name).order_by(desc(func.count(TreatmentItem.id))).limit(8).all()

        treatments_by_procedure = [
            ProcedureCount(procedure_name=proc, count=cnt) for proc, cnt in treatment_stats
        ]

        # 3. Revenue trend (omitted / zeroed)
        revenue_points: list[RevenueTrendPoint] = []

        # 4. Patients registration trend
        patient_points = []
        for d in range(min(days, 14)):
            day_target = today - timedelta(days=min(days, 14) - 1 - d)
            next_day = day_target + timedelta(days=1)

            count = db.query(func.count(Patient.id)).filter(
                Patient.created_at >= datetime.combine(day_target, datetime.min.time(), tzinfo=UTC),
                Patient.created_at < datetime.combine(next_day, datetime.min.time(), tzinfo=UTC),
                Patient.is_deleted == False
            ).scalar() or 0

            patient_points.append(PatientTrendPoint(
                date=day_target.strftime('%b %d'),
                new_patients=count
            ))

        return DashboardAnalyticsResponse(
            appointments_by_status=appointments_by_status,
            treatments_by_procedure=treatments_by_procedure,
            revenue_trend=revenue_points,
            patients_trend=patient_points
        )

    @staticmethod
    def get_admin_dashboard(db: Session) -> AdminDashboardResponse:
        """Admin dashboard: total counts, doctor-wise & student-wise distribution, and recent activity."""
        total_doctors = db.query(func.count(Doctor.id)).filter(Doctor.account_status == "active").scalar() or 0
        total_students = db.query(func.count(Student.id)).filter(Student.account_status == "active").scalar() or 0
        total_patients = db.query(func.count(Patient.id)).filter(Patient.is_deleted == False).scalar() or 0

        # Doctor-wise patient counts
        doctors = db.query(Doctor).all()
        doc_counts = []
        for d in doctors:
            stu_cnt = db.query(func.count(Student.id)).filter(Student.doctor_id == d.id).scalar() or 0
            pat_cnt = db.query(func.count(Patient.id)).filter(Patient.doctor_id == d.id, Patient.is_deleted == False).scalar() or 0
            doc_counts.append(DoctorPatientCount(
                doctor_id=d.id,
                doctor_name=d.doctor_name,
                specialization=d.specialization,
                student_count=stu_cnt,
                patient_count=pat_cnt
            ))

        # Student-wise patient counts
        students = db.query(Student).all()
        stu_counts = []
        for s in students:
            pat_cnt = db.query(func.count(Patient.id)).filter(Patient.student_id == s.id, Patient.is_deleted == False).scalar() or 0
            stu_counts.append(StudentPatientCount(
                student_id=s.id,
                student_name=s.student_name,
                doctor_name=s.doctor.doctor_name if s.doctor else "Unassigned",
                enrollment_number=s.enrollment_number,
                patient_count=pat_cnt
            ))

        # Recent registrations across Doctors, Students, Patients
        recent_items = []
        recent_docs = db.query(Doctor).order_by(desc(Doctor.created_at)).limit(5).all()
        for d in recent_docs:
            recent_items.append(RecentRegistrationItem(
                entity_type="Doctor",
                id=d.id,
                name=d.doctor_name,
                code_or_email=d.email,
                created_at=d.created_at.strftime("%d %b %Y, %H:%M")
            ))

        recent_stus = db.query(Student).order_by(desc(Student.created_at)).limit(5).all()
        for s in recent_stus:
            recent_items.append(RecentRegistrationItem(
                entity_type="Student",
                id=s.id,
                name=s.student_name,
                code_or_email=s.enrollment_number,
                created_at=s.created_at.strftime("%d %b %Y, %H:%M")
            ))

        recent_pats = db.query(Patient).filter(Patient.is_deleted == False).order_by(desc(Patient.created_at)).limit(5).all()
        for p in recent_pats:
            recent_items.append(RecentRegistrationItem(
                entity_type="Patient",
                id=p.id,
                name=p.full_name,
                code_or_email=p.patient_code,
                created_at=p.created_at.strftime("%d %b %Y, %H:%M")
            ))

        return AdminDashboardResponse(
            total_doctors=total_doctors,
            total_students=total_students,
            total_patients=total_patients,
            doctor_wise_patients=doc_counts,
            student_wise_patients=stu_counts,
            recent_registrations=recent_items
        )

    @staticmethod
    def get_doctor_dashboard(db: Session, current_user: User) -> DoctorDashboardResponse:
        """Doctor dashboard: My students, patients breakdown (direct vs assigned), and clinical alerts."""
        doc = db.query(Doctor).filter((Doctor.user_id == current_user.id) | (Doctor.email == current_user.email)).first()
        if not doc and current_user.doctor_id:
            doc = db.query(Doctor).filter(Doctor.id == current_user.doctor_id).first()
        doc_id = doc.id if doc else 1
        doc_name = doc.doctor_name if doc else current_user.full_name

        my_students_count = db.query(func.count(Student.id)).filter(Student.doctor_id == doc_id, Student.account_status == "active").scalar() or 0
        my_patients_count = db.query(func.count(Patient.id)).filter(Patient.doctor_id == doc_id, Patient.is_deleted == False).scalar() or 0
        direct_patients_count = db.query(func.count(Patient.id)).filter(
            Patient.doctor_id == doc_id,
            Patient.student_id == None,
            Patient.is_deleted == False
        ).scalar() or 0
        assigned_patients_count = db.query(func.count(Patient.id)).filter(
            Patient.doctor_id == doc_id,
            Patient.student_id != None,
            Patient.is_deleted == False
        ).scalar() or 0

        # Roster of students registered under this doctor
        students = db.query(Student).filter(Student.doctor_id == doc_id).all()
        student_list = []
        for s in students:
            assigned_pts = db.query(func.count(Patient.id)).filter(Patient.student_id == s.id, Patient.is_deleted == False).scalar() or 0
            student_list.append({
                "id": s.id,
                "name": s.student_name,
                "email": s.email,
                "phone": s.phone_number,
                "enrollment_number": s.enrollment_number,
                "college": s.college_institution,
                "status": s.account_status,
                "assigned_patients_count": assigned_pts
            })

        # Recent patient registrations under this doctor
        recent_pats = db.query(Patient).filter(
            Patient.doctor_id == doc_id,
            Patient.is_deleted == False
        ).order_by(desc(Patient.created_at)).limit(10).all()
        recent_pat_list = []
        for p in recent_pats:
            recent_pat_list.append({
                "id": p.id,
                "patient_code": p.patient_code,
                "cr_number": p.cr_number,
                "name": p.full_name,
                "phone": p.phone,
                "gender": p.gender,
                "assigned_student": p.student.student_name if p.student else None,
                "created_at": p.created_at.strftime("%d %b %Y")
            })

        # Pending follow-ups
        today = date.today()
        followups = db.query(FollowUp).join(Patient).filter(
            Patient.doctor_id == doc_id,
            FollowUp.status == "pending"
        ).order_by(FollowUp.scheduled_date.asc()).limit(10).all()
        fu_list = []
        for fu in followups:
            fu_list.append({
                "id": fu.id,
                "patient_id": fu.patient_id,
                "patient_name": fu.patient.full_name,
                "scheduled_date": fu.scheduled_date.strftime("%d %b %Y"),
                "reason": fu.reason,
                "is_overdue": fu.scheduled_date < today
            })

        return DoctorDashboardResponse(
            doctor_id=doc_id,
            doctor_name=doc_name,
            my_students_count=my_students_count,
            my_patients_count=my_patients_count,
            direct_patients_count=direct_patients_count,
            assigned_patients_count=assigned_patients_count,
            my_students=student_list,
            recent_patients=recent_pat_list,
            pending_followups=fu_list
        )

    @staticmethod
    def get_student_dashboard(db: Session, current_user: User) -> StudentDashboardResponse:
        """Student dashboard: My assigned patients, pending records, and upcoming sessions."""
        stu = db.query(Student).filter((Student.user_id == current_user.id) | (Student.email == current_user.email)).first()
        if not stu and current_user.student_id:
            stu = db.query(Student).filter(Student.id == current_user.student_id).first()
        stu_id = stu.id if stu else 1
        stu_name = stu.student_name if stu else current_user.full_name
        doc_name = stu.doctor.doctor_name if stu and stu.doctor else "Supervising Doctor"

        my_patients_count = db.query(func.count(Patient.id)).filter(Patient.student_id == stu_id, Patient.is_deleted == False).scalar() or 0

        # Patients assigned to this student
        assigned_pts = db.query(Patient).filter(
            Patient.student_id == stu_id,
            Patient.is_deleted == False
        ).order_by(desc(Patient.created_at)).all()

        pat_list = []
        for p in assigned_pts:
            pat_list.append({
                "id": p.id,
                "patient_code": p.patient_code,
                "cr_number": p.cr_number,
                "name": p.full_name,
                "phone": p.phone,
                "gender": p.gender,
                "disease_categories": p.disease_categories or [],
                "created_at": p.created_at.strftime("%d %b %Y")
            })

        # Pending treatment items for student's patients
        patient_ids = [p.id for p in assigned_pts]
        pending_records_cnt = 0
        if patient_ids:
            pending_records_cnt = db.query(func.count(TreatmentItem.id)).join(
                Patient, TreatmentItem.treatment_plan_id == Patient.id, isouter=True
            ).filter(TreatmentItem.status.in_(["planned", "in_progress"])).scalar() or 0

        # Upcoming appointments for student's patients
        today = date.today()
        upcoming_appts = []
        if patient_ids:
            appts = db.query(Appointment).filter(
                Appointment.patient_id.in_(patient_ids),
                Appointment.appointment_date >= today,
                Appointment.status.notin_(["cancelled", "completed"])
            ).order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc()).limit(10).all()
            for a in appts:
                upcoming_appts.append({
                    "id": a.id,
                    "patient_id": a.patient_id,
                    "patient_name": a.patient.full_name,
                    "date": a.appointment_date.strftime("%d %b %Y"),
                    "time": f"{str(a.start_time)[:5]} - {str(a.end_time)[:5]}",
                    "reason": a.reason or "Clinical Session",
                    "status": a.status
                })

        return StudentDashboardResponse(
            student_id=stu_id,
            student_name=stu_name,
            doctor_name=doc_name,
            my_patients_count=my_patients_count,
            my_patients=pat_list,
            recent_patients=pat_list[:10],
            pending_records_count=pending_records_cnt,
            upcoming_appointments=upcoming_appts
        )
