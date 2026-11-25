from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    roll_number = Column(String(100), unique=True, nullable=False)
    year_of_study = Column(String(50), nullable=True)
    department = Column(String(150), nullable=True)
    college_institution = Column(String(255), nullable=False, default="PGI Oral Health Sciences Centre")
    is_active = Column(Boolean, default=True, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    user = relationship("User", back_populates="student_profile", foreign_keys=[user_id])
    doctor = relationship("Doctor", back_populates="students", foreign_keys=[doctor_id])
    patients = relationship("Patient", back_populates="student", foreign_keys="Patient.student_id")

    @property
    def student_name(self) -> str:
        return self.full_name

    @property
    def enrollment_number(self) -> str:
        return self.roll_number

    @property
    def phone_number(self) -> str | None:
        return self.phone

    @property
    def account_status(self) -> str:
        return "active" if (self.is_active and self.revoked_at is None) else "inactive"
