from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.constants import OPERATORIES
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentMissedCreate,
    AppointmentStatusUpdate,
    AppointmentUpdate,
)
from app.security.dependencies import resolve_doctor_for_user, resolve_student_for_user, verify_patient_access
from app.services.google_calendar_service import sync_appointment_to_google_calendar
from app.services.notification_service import NotificationService


class AppointmentService:
    @staticmethod
    def check_conflict(
        db: Session,
        doctor_id: int,
        operatory: str,
        appointment_date: date,
        start_time: time,
        end_time: time,
        exclude_id: int | None = None,
    ) -> str | None:
        """
        Check if either the doctor OR the operatory/chair has an overlapping active appointment.
        Returns conflict reason string if conflict exists, else None.
        """
        base = db.query(Appointment).filter(
            Appointment.appointment_date == appointment_date,
            Appointment.status.notin_(["cancelled", "no_show"]),
            Appointment.start_time < end_time,
            Appointment.end_time > start_time,
        )
        if exclude_id:
            base = base.filter(Appointment.id != exclude_id)

        doc_conflict = base.filter(Appointment.doctor_id == doctor_id).first()
        if doc_conflict:
            return "The selected doctor already has a conflicting appointment at this date and time."

        op_conflict = base.filter(Appointment.operatory == operatory).first()
        if op_conflict:
            return f"Operatory '{operatory}' is already booked during this time slot."

        return None

    @classmethod
    def create_appointment(
        cls,
        db: Session,
        data: AppointmentCreate,
        current_user: User,
        request: Request | None = None,
    ) -> Appointment:
        """Create a new appointment with doctor & operatory conflict prevention + automated notifications."""
        patient = verify_patient_access(db, current_user, data.patient_id, require_write=True)

        doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id, Doctor.is_active == True).first()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCTOR_NOT_FOUND", "message": "Doctor does not exist or is inactive."},
            )

        if data.start_time >= data.end_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_TIME_RANGE", "message": "Appointment end time must be after start time."},
            )

        operatory = data.operatory or doctor.cabin_operatory or "Operatory 1"
        conflict_msg = cls.check_conflict(
            db,
            doctor_id=doctor.id,
            operatory=operatory,
            appointment_date=data.appointment_date,
            start_time=data.start_time,
            end_time=data.end_time,
        )
        if conflict_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "APPOINTMENT_CONFLICT", "message": conflict_msg},
            )

        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            student_id=data.student_id or patient.student_id,
            operatory=operatory,
            appointment_type=data.appointment_type or "Routine Checkup & Consultation",
            appointment_date=data.appointment_date,
            start_time=data.start_time,
            end_time=data.end_time,
            status="scheduled",
            attendance_status="pending",
            reason=data.reason,
            notes=data.notes,
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

        gcal_res = sync_appointment_to_google_calendar(appointment, patient, doctor)
        if gcal_res.get("google_event_id"):
            appointment.google_event_id = gcal_res["google_event_id"]
            db.commit()
            db.refresh(appointment)

        log_audit_event(
            db=db,
            action="CREATE",
            user=current_user,
            entity_name="Appointment",
            entity_id=str(appointment.id),
            patient_id=patient.id,
            details={"patient_id": patient.id, "doctor_id": doctor.id, "operatory": operatory, "date": str(data.appointment_date)},
            request=request,
        )

        NotificationService.send_appointment_lifecycle_alert(
            db, appointment, "confirmed", actor_user=current_user
        )
        return appointment

    @staticmethod
    def get_appointments(
        db: Session,
        current_user: User,
        appointment_date: date | None = None,
        doctor_id: int | None = None,
        patient_id: int | None = None,
        status_filter: str | None = None,
        operatory: str | None = None,
    ) -> list[Appointment]:
        """Fetch appointments scoped by role."""
        query = db.query(Appointment)

        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return []
            assigned_ids = [
                r[0]
                for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
            ]
            if not assigned_ids:
                return []
            query = query.filter(Appointment.patient_id.in_(assigned_ids))
        elif current_user.role == "patient":
            query = query.filter(Appointment.patient_id == (current_user.patient_id or 0))

        if appointment_date:
            query = query.filter(Appointment.appointment_date == appointment_date)
        if doctor_id:
            query = query.filter(Appointment.doctor_id == doctor_id)
        if patient_id:
            query = query.filter(Appointment.patient_id == patient_id)
        if status_filter:
            query = query.filter(Appointment.status == status_filter)
        if operatory:
            query = query.filter(Appointment.operatory == operatory)

        return query.order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc()).all()

    @classmethod
    def get_calendar_data(
        cls,
        db: Session,
        current_user: User,
        target_date: date,
        view: str = "doctor",
        range_mode: str = "day",
    ) -> dict[str, Any]:
        """Return Smart Calendar schedule grouped for Doctor-wise and Operatory-wise views."""
        if range_mode == "week":
            start_date = target_date - timedelta(days=target_date.weekday())
            end_date = start_date + timedelta(days=6)
        else:
            start_date = target_date
            end_date = target_date

        query = db.query(Appointment).filter(
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date <= end_date,
        )

        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                appts = []
            else:
                assigned_ids = [
                    r[0]
                    for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
                ]
                appts = (
                    query.filter(Appointment.patient_id.in_(assigned_ids))
                    .order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc())
                    .all()
                    if assigned_ids
                    else []
                )
        else:
            appts = query.order_by(Appointment.appointment_date.asc(), Appointment.start_time.asc()).all()

        doctors = (
            db.query(Doctor)
            .filter(Doctor.is_active == True)
            .order_by(Doctor.id.asc())
            .all()
        )
        doctor_list = [
            {
                "id": d.id,
                "full_name": d.full_name,
                "specialization": d.specialization,
                "department": d.department,
                "cabin_operatory": d.cabin_operatory,
            }
            for d in doctors
        ]

        op_set = list(OPERATORIES)
        for d in doctors:
            if d.cabin_operatory and d.cabin_operatory not in op_set:
                op_set.append(d.cabin_operatory)
        for a in appts:
            if a.operatory and a.operatory not in op_set:
                op_set.append(a.operatory)

        return {
            "date": target_date.isoformat(),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "range": range_mode,
            "view": view,
            "doctors": doctor_list,
            "operatories": op_set,
            "appointments": appts,
        }

    @staticmethod
    def get_appointment_by_id(db: Session, appointment_id: int, current_user: User) -> Appointment:
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "APPOINTMENT_NOT_FOUND", "message": f"Appointment with ID {appointment_id} does not exist."},
            )
        verify_patient_access(db, current_user, appt.patient_id, allow_receptionist=True, allow_patient_self=True)
        return appt

    @classmethod
    def update_appointment(
        cls,
        db: Session,
        appointment_id: int,
        data: AppointmentUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> Appointment:
        appt = cls.get_appointment_by_id(db, appointment_id, current_user)
        verify_patient_access(db, current_user, appt.patient_id, require_write=True)

        target_doctor = data.doctor_id or appt.doctor_id
        target_operatory = data.operatory or appt.operatory
        target_date = data.appointment_date or appt.appointment_date
        target_start = data.start_time or appt.start_time
        target_end = data.end_time or appt.end_time

        if target_start >= target_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_TIME_RANGE", "message": "Appointment end time must be after start time."},
            )

        conflict_msg = cls.check_conflict(
            db,
            doctor_id=target_doctor,
            operatory=target_operatory,
            appointment_date=target_date,
            start_time=target_start,
            end_time=target_end,
            exclude_id=appt.id,
        )
        if conflict_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "APPOINTMENT_CONFLICT", "message": conflict_msg},
            )

        update_dict = data.model_dump(exclude_unset=True)
        update_dict.pop("dentist_id", None)
        for k, v in update_dict.items():
            if hasattr(appt, k):
                setattr(appt, k, v)

        db.commit()
        db.refresh(appt)

        log_audit_event(
            db=db,
            action="UPDATE",
            user=current_user,
            entity_name="Appointment",
            entity_id=str(appt.id),
            patient_id=appt.patient_id,
            details={"changes": list(update_dict.keys())},
            request=request,
        )

        event_kind = "cancelled" if appt.status == "cancelled" else "updated"
        NotificationService.send_appointment_lifecycle_alert(
            db, appt, event_kind, actor_user=current_user
        )
        return appt

    @classmethod
    def update_status(
        cls,
        db: Session,
        appointment_id: int,
        data: AppointmentStatusUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> Appointment:
        appt = cls.get_appointment_by_id(db, appointment_id, current_user)
        verify_patient_access(db, current_user, appt.patient_id, require_write=True)

        appt.status = data.status
        if data.cancellation_reason:
            appt.cancellation_reason = data.cancellation_reason
        if data.status == "no_show":
            appt.is_missed = True
            appt.attendance_status = "missed"
            if appt.patient:
                appt.patient.tracker_stage = "slipping"

        db.commit()
        db.refresh(appt)

        log_audit_event(
            db=db,
            action="STATUS_CHANGE",
            user=current_user,
            entity_name="Appointment",
            entity_id=str(appt.id),
            patient_id=appt.patient_id,
            details={"new_status": data.status, "reason": data.cancellation_reason},
            request=request,
        )

        if data.status == "cancelled":
            NotificationService.send_appointment_lifecycle_alert(db, appt, "cancelled", actor_user=current_user)
        elif data.status == "confirmed":
            NotificationService.send_appointment_lifecycle_alert(db, appt, "confirmed", actor_user=current_user)
        elif data.status == "no_show":
            NotificationService.send_appointment_lifecycle_alert(db, appt, "missed_recall", actor_user=current_user)

        return appt

    @classmethod
    def log_missed_appointment(
        cls,
        db: Session,
        data: AppointmentMissedCreate,
        current_user: User,
        request: Request | None = None,
    ) -> Appointment:
        """Doctor/Admin: Log a missed patient / missed appointment directly from Doctor Dashboard."""
        patient: Patient | None = None
        if data.patient_id:
            patient = db.query(Patient).filter(Patient.id == data.patient_id, Patient.is_deleted == False).first()
        elif data.cr_number:
            patient = db.query(Patient).filter(
                or_(Patient.cr_number == data.cr_number.strip(), Patient.patient_code == data.cr_number.strip()),
                Patient.is_deleted == False,
            ).first()

        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found for missed appointment log."},
            )

        doc = None
        if data.doctor_id:
            doc = db.query(Doctor).filter(Doctor.id == data.doctor_id).first()
        if not doc:
            doc = resolve_doctor_for_user(db, current_user)
        if not doc and patient.doctor_id:
            doc = db.query(Doctor).filter(Doctor.id == patient.doctor_id).first()
        if not doc:
            doc = db.query(Doctor).filter(Doctor.is_active == True).order_by(Doctor.id.asc()).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "NO_DOCTOR", "message": "No doctor available to attach missed appointment."},
            )

        target_date = data.appointment_date or date.today()
        start_t = data.start_time or time(9, 0)
        end_dt = datetime.combine(target_date, start_t) + timedelta(minutes=30)
        end_t = data.end_time or end_dt.time()

        appt = Appointment(
            patient_id=patient.id,
            doctor_id=doc.id,
            student_id=patient.student_id,
            operatory=data.operatory or doc.cabin_operatory or "Operatory 1",
            appointment_type="Missed Clinical Visit",
            appointment_date=target_date,
            start_time=start_t,
            end_time=end_t,
            status="no_show",
            attendance_status="missed",
            is_missed=True,
            missed_reason=data.missed_reason,
            reason=data.missed_reason,
        )
        db.add(appt)
        patient.attendance_status = "missed"
        patient.tracker_stage = "slipping"
        db.commit()
        db.refresh(appt)

        log_audit_event(
            db=db,
            action="MISSED_APPOINTMENT_LOGGED",
            user=current_user,
            entity_name="Appointment",
            entity_id=str(appt.id),
            patient_id=patient.id,
            details={"reason": data.missed_reason, "date": target_date.isoformat(), "send_recall": data.send_recall},
            request=request,
        )

        if data.send_recall:
            NotificationService.send_appointment_lifecycle_alert(db, appt, "missed_recall", actor_user=current_user)

        return appt
