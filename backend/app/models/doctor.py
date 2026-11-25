from datetime import datetime, UTC
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    doctor_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(50), nullable=True)
    qualification = Column(String(255), nullable=True)
    specialization = Column(String(150), nullable=False, default="General Dentistry")
    registration_number = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    account_status = Column(String(50), default="active", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    students = relationship("Student", back_populates="doctor", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="doctor")
    user = relationship("User", foreign_keys=[user_id])
