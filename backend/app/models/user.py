from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), index=True, nullable=False, default="patient")  # admin|doctor|student|receptionist|patient
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    token_version = Column(Integer, default=1, nullable=False)
    refresh_tokens_json = Column(JSON, default=list, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # 1-to-1 profile links via child FKs (avoids circular FK dependencies)
    doctor_profile = relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        foreign_keys="Doctor.user_id",
    )
    student_profile = relationship(
        "Student",
        back_populates="user",
        uselist=False,
        foreign_keys="Student.user_id",
    )
    patient_profile = relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        foreign_keys="Patient.user_id",
    )

    @property
    def hashed_password(self) -> str:
        return self.password_hash

    @hashed_password.setter
    def hashed_password(self, value: str) -> None:
        self.password_hash = value

    @property
    def doctor_id(self) -> int | None:
        return self.doctor_profile.id if self.doctor_profile else None

    @property
    def student_id(self) -> int | None:
        return self.student_profile.id if self.student_profile else None

    @property
    def patient_id(self) -> int | None:
        return self.patient_profile.id if self.patient_profile else None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin" or bool(self.doctor_profile and self.doctor_profile.is_admin)

    @property
    def dentist_profile(self):
        return self.doctor_profile
