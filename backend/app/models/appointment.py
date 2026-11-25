from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import relationship

from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    operatory = Column(String(100), index=True, nullable=False, default="Operatory 1")
    appointment_type = Column(String(150), nullable=False, default="Routine Checkup & Consultation")
    appointment_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(String(50), default="scheduled", nullable=False, index=True)
    attendance_status = Column(String(50), default="pending", nullable=False)
    attendance_marked_at = Column(DateTime, nullable=True)
    attendance_marked_by = Column(Integer, nullable=True)
    is_missed = Column(Boolean, default=False, nullable=False)
    missed_reason = Column(Text, nullable=True)
    google_event_id = Column(String(255), nullable=True)
    reason = Column(String(255), nullable=True)
    cancellation_reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="appointments", foreign_keys=[patient_id])
    doctor = relationship("Doctor", back_populates="appointments", foreign_keys=[doctor_id])
    student = relationship("Student", foreign_keys=[student_id])

    @property
    def dentist_id(self) -> int:
        return self.doctor_id

    @property
    def doctor_name(self) -> str | None:
        return self.doctor.full_name if self.doctor else None
