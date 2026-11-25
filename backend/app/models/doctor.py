from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    specialization = Column(String(150), nullable=False, default="General Dentistry")
    department = Column(String(150), nullable=False, default="Oral Health Sciences")
    license_number = Column(String(100), unique=True, nullable=False)
    cabin_operatory = Column(String(100), nullable=False, default="Operatory 1")
    is_admin = Column(Boolean, default=False, nullable=False)
    google_calendar_id = Column(String(255), nullable=True)
    google_oauth_tokens = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    user = relationship("User", back_populates="doctor_profile", foreign_keys=[user_id])
    students = relationship("Student", back_populates="doctor", foreign_keys="Student.doctor_id")
    patients = relationship("Patient", back_populates="doctor", foreign_keys="Patient.doctor_id")
    appointments = relationship("Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id")

    @property
    def doctor_name(self) -> str:
        return self.full_name

    @property
    def registration_number(self) -> str:
        return self.license_number

    @property
    def phone_number(self) -> str | None:
        return self.phone

    @property
    def account_status(self) -> str:
        return "active" if self.is_active else "inactive"

    @property
    def cabin_number(self) -> str:
        return self.cabin_operatory

    @property
    def qualification(self) -> str:
        return self.department

    @property
    def qualifications(self) -> str:
        return self.department
