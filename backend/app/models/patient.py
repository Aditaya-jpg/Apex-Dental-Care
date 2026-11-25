from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_code = Column(String(50), unique=True, index=True, nullable=False)
    cr_number = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(200), nullable=False)
    first_name = Column(String(100), index=True, nullable=False)
    last_name = Column(String(100), index=True, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False)  # Male, Female, Other
    phone = Column(String(50), index=True, nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    blood_group = Column(String(10), nullable=True)
    emergency_contact_name = Column(String(150), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    preferred_language = Column(String(10), nullable=False, default="en")

    # Categorization, Triage & Consent
    disease_categories = Column(JSON, default=list, nullable=False)
    case_keywords = Column(JSON, default=list, nullable=False)
    special_case_flag = Column(Boolean, default=False, nullable=False)
    pain_scale = Column(Integer, default=0, nullable=False)
    severity_level = Column(String(30), default="none", nullable=False)
    parent_consent_required = Column(Boolean, default=False, nullable=False)
    parent_guardian_name = Column(String(150), nullable=True)
    parent_guardian_phone = Column(String(50), nullable=True)
    parent_consent_status = Column(String(30), default="not_required", nullable=False)
    parent_consent_doc_id = Column(Integer, nullable=True)
    card_doc_id = Column(Integer, nullable=True)
    card_verification_status = Column(String(50), default="pending", nullable=False)

    # 1-to-1 Structured Clinical JSON Columns
    medical_history_json = Column(JSON, default=dict, nullable=False)
    dental_history_json = Column(JSON, default=dict, nullable=False)
    dental_chart_json = Column(JSON, default=dict, nullable=False)
    perio_chart_json = Column(JSON, default=dict, nullable=False)
    misc_records_json = Column(JSON, default=dict, nullable=False)
    patient_shared_notices_json = Column(JSON, default=list, nullable=False)

    # Attendance & Funnel Tracking
    attendance_status = Column(String(30), default="not_arrived", nullable=False)
    last_attendance_at = Column(DateTime, nullable=True)
    tracker_stage = Column(String(30), default="registered", nullable=False)
    source_channel = Column(String(50), default="walk_in", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])
    doctor = relationship("Doctor", back_populates="patients", foreign_keys=[doctor_id])
    student = relationship("Student", back_populates="patients", foreign_keys=[student_id])
    appointments = relationship("Appointment", back_populates="patient", foreign_keys="Appointment.patient_id")
    clinical_records = relationship(
        "ClinicalRecord",
        back_populates="patient",
        cascade="all, delete-orphan",
        foreign_keys="ClinicalRecord.patient_id",
    )
    documents = relationship(
        "Document",
        back_populates="patient",
        cascade="all, delete-orphan",
        foreign_keys="Document.patient_id",
    )
    care_logs = relationship(
        "CareAndSystemLog",
        back_populates="patient",
        foreign_keys="CareAndSystemLog.patient_id",
    )

    @property
    def age(self) -> int:
        if not self.date_of_birth:
            return 0
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    @property
    def patient_name(self) -> str:
        return self.full_name or f"{self.first_name} {self.last_name}".strip()

    @property
    def doctor_name(self) -> str | None:
        return self.doctor.full_name if self.doctor else None

    @property
    def student_name(self) -> str | None:
        return self.student.full_name if self.student else None

    @property
    def patient_card_document(self) -> str | None:
        return f"/api/v1/patients/{self.id}/card" if self.card_doc_id else None

    @property
    def account_status(self) -> str:
        return "inactive" if self.is_deleted else "active"
