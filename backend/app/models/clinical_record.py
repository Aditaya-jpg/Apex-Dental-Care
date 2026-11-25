from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class ClinicalRecord(Base):
    __tablename__ = "clinical_records"

    id = Column(Integer, primary_key=True, index=True)
    # patient_id is nullable so reusable rx_template rows can live here with patient_id=NULL
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    record_type = Column(String(50), index=True, nullable=False)  # visit|treatment_plan|surgical_log|prescription|rx_template
    record_date = Column(Date, index=True, nullable=False, default=date.today)
    title = Column(String(255), nullable=False, default="")
    status = Column(String(50), nullable=False, default="active")
    language = Column(String(10), nullable=False, default="en")
    is_visible_to_patient = Column(Boolean, default=False, nullable=False)
    payload_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    patient = relationship("Patient", back_populates="clinical_records", foreign_keys=[patient_id])
    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    student = relationship("Student", foreign_keys=[student_id])
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
