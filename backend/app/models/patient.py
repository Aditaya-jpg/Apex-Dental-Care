from datetime import datetime, UTC

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String(50), unique=True, index=True, nullable=False)
    first_name = Column(String(100), index=True, nullable=False)
    last_name = Column(String(100), index=True, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False) # Male, Female, Other
    phone = Column(String(50), index=True, nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(150), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    blood_group = Column(String(10), nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    cr_number = Column(String(100), unique=True, index=True, nullable=True)
    disease_categories = Column(JSON, default=list, nullable=True)
    patient_card_document = Column(String(500), nullable=True)
    card_verification_status = Column(String(50), default="pending", nullable=False)
    account_status = Column(String(50), default="active", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    doctor = relationship("Doctor", back_populates="patients")
    student = relationship("Student", back_populates="patients")
    medical_history = relationship("MedicalHistory", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    dental_history = relationship("DentalHistory", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient")
    visits = relationship("Visit", back_populates="patient")
    tooth_conditions = relationship("ToothCondition", back_populates="patient", cascade="all, delete-orphan")
    treatment_plans = relationship("TreatmentPlan", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    invoices = relationship("Invoice", back_populates="patient")
    documents = relationship("Document", back_populates="patient")
    followups = relationship("FollowUp", back_populates="patient")
    user_account = relationship("User", back_populates="patient", uselist=False)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def patient_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def doctor_name(self) -> str | None:
        return self.doctor.doctor_name if self.doctor else None

    @property
    def student_name(self) -> str | None:
        return self.student.student_name if self.student else None

    @property
    def age(self) -> int:
        if not self.date_of_birth:
            return 0
        from datetime import date
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

class MedicalHistory(Base):
    __tablename__ = "medical_histories"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), unique=True, nullable=False)
    allergies = Column(Text, nullable=True)
    medical_conditions = Column(Text, nullable=True) # e.g. Hypertension, Diabetes
    current_medications = Column(Text, nullable=True)
    past_surgeries = Column(Text, nullable=True)
    bleeding_disorders = Column(Boolean, default=False, nullable=False)
    is_pregnant = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    patient = relationship("Patient", back_populates="medical_history")

class DentalHistory(Base):
    __tablename__ = "dental_histories"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), unique=True, nullable=False)
    chief_complaint = Column(Text, nullable=True)
    past_dental_treatments = Column(Text, nullable=True)
    brushing_frequency = Column(String(50), nullable=True) # Once daily, Twice daily, etc.
    flossing = Column(Boolean, default=False, nullable=False)
    habits = Column(Text, nullable=True) # Smoking, Tobacco, Bruxism, Clenching
    dental_anxiety_level = Column(String(50), nullable=True) # None, Mild, Moderate, Severe
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    patient = relationship("Patient", back_populates="dental_history")
