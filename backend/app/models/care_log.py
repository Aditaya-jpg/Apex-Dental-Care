from datetime import UTC, datetime

from sqlalchemy import JSON, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class CareAndSystemLog(Base):
    __tablename__ = "care_and_system_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), index=True, nullable=False)  # enquiry|followup|recall|notification|audit|clinic_config
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    assigned_student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), index=True, nullable=False, default="open")
    scheduled_date = Column(Date, index=True, nullable=True)
    channel = Column(String(50), nullable=False, default="system")
    language = Column(String(10), nullable=False, default="en")
    title = Column(String(255), nullable=True)
    payload_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="care_logs", foreign_keys=[patient_id])
    actor_user = relationship("User", foreign_keys=[actor_user_id])
    assigned_doctor = relationship("Doctor", foreign_keys=[assigned_doctor_id])
    assigned_student = relationship("Student", foreign_keys=[assigned_student_id])
